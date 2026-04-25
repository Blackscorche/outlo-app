-- =====================================================================
-- Outlo: Activities upgrade + Tickets + Boosts
-- =====================================================================
-- Extends the existing `activities` table with category/pricing/boost/image
-- and creates `activity_tickets` and `activity_boosts` for monetization.
-- =====================================================================

-- ---------- 1. Extend activities ----------
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS duration_minutes int,
  ADD COLUMN IF NOT EXISTS join_type text DEFAULT 'everyone'
    CHECK (join_type IN ('everyone','beginners','advanced')),
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticket_price_cents int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS payment_required_to_join boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_boosted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_plan text
    CHECK (boost_plan IN ('24h','3d','7d')),
  ADD COLUMN IF NOT EXISTS boost_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS boost_end_at timestamptz;

-- Loosen the `status` constraint to include draft/published.
-- We keep existing values 'open','full','completed','cancelled' for back-compat.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'activities' AND constraint_name = 'activities_status_check'
  ) THEN
    ALTER TABLE public.activities DROP CONSTRAINT activities_status_check;
  END IF;
END$$;

ALTER TABLE public.activities
  ADD CONSTRAINT activities_status_check
  CHECK (status IN ('draft','published','open','full','completed','cancelled'));

-- Indexes for boost discovery and category filtering
CREATE INDEX IF NOT EXISTS idx_activities_is_boosted
  ON public.activities (is_boosted, boost_end_at)
  WHERE is_boosted = true;
CREATE INDEX IF NOT EXISTS idx_activities_category
  ON public.activities (category);

-- ---------- 2. activity_tickets ----------
CREATE TABLE IF NOT EXISTS public.activity_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  buyer_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Money (all in minor units / cents to avoid float)
  gross_amount_cents    int NOT NULL,
  service_fee_cents     int NOT NULL DEFAULT 0,
  platform_fee_cents    int NOT NULL DEFAULT 0,
  processor_fee_cents   int NOT NULL DEFAULT 0,
  creator_payout_cents  int NOT NULL DEFAULT 0,
  currency              text NOT NULL DEFAULT 'EUR',

  -- Stripe
  stripe_session_id        text,
  stripe_payment_intent_id text,

  -- Status (kept separate per brief)
  payment_status  text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded')),
  booking_status  text NOT NULL DEFAULT 'pending'
    CHECK (booking_status IN ('pending','confirmed','cancelled')),

  -- Ticket / QR code
  ticket_code     uuid NOT NULL DEFAULT gen_random_uuid(),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz,
  refunded_at     timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_tickets_code
  ON public.activity_tickets (ticket_code);
CREATE INDEX IF NOT EXISTS idx_activity_tickets_buyer
  ON public.activity_tickets (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_tickets_activity_paid
  ON public.activity_tickets (activity_id, payment_status);

-- ---------- 3. activity_boosts ----------
CREATE TABLE IF NOT EXISTS public.activity_boosts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  creator_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  plan_type       text NOT NULL CHECK (plan_type IN ('24h','3d','7d')),
  amount_cents    int NOT NULL,
  currency        text NOT NULL DEFAULT 'EUR',

  payment_status  text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded')),

  -- IAP receipt linkage (boosts are digital goods → IAP)
  iap_platform        text CHECK (iap_platform IN ('ios','android')),
  iap_product_id      text,
  iap_transaction_id  text,
  iap_purchase_token  text,

  start_at        timestamptz,
  end_at          timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_boosts_activity
  ON public.activity_boosts (activity_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_activity_boosts_creator
  ON public.activity_boosts (creator_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_boosts_iap_txn
  ON public.activity_boosts (iap_transaction_id)
  WHERE iap_transaction_id IS NOT NULL;

-- ---------- 4. updated_at triggers ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activity_tickets_updated_at ON public.activity_tickets;
CREATE TRIGGER trg_activity_tickets_updated_at
  BEFORE UPDATE ON public.activity_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_activity_boosts_updated_at ON public.activity_boosts;
CREATE TRIGGER trg_activity_boosts_updated_at
  BEFORE UPDATE ON public.activity_boosts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 5. RLS ----------
ALTER TABLE public.activity_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_boosts  ENABLE ROW LEVEL SECURITY;

-- Tickets: buyer sees own tickets; activity creator sees tickets for their activities
DROP POLICY IF EXISTS "buyer_select_own_tickets" ON public.activity_tickets;
CREATE POLICY "buyer_select_own_tickets"
  ON public.activity_tickets FOR SELECT
  USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "creator_select_activity_tickets" ON public.activity_tickets;
CREATE POLICY "creator_select_activity_tickets"
  ON public.activity_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_tickets.activity_id AND a.creator_id = auth.uid()
    )
  );

-- Inserts/updates only by service role (edge functions). Block direct client writes.
DROP POLICY IF EXISTS "service_role_write_tickets" ON public.activity_tickets;
CREATE POLICY "service_role_write_tickets"
  ON public.activity_tickets FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Boosts: creator can read their boosts; service role writes
DROP POLICY IF EXISTS "creator_select_own_boosts" ON public.activity_boosts;
CREATE POLICY "creator_select_own_boosts"
  ON public.activity_boosts FOR SELECT
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "service_role_write_boosts" ON public.activity_boosts;
CREATE POLICY "service_role_write_boosts"
  ON public.activity_boosts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------- 6. Helper view: spots_left ----------
CREATE OR REPLACE VIEW public.activities_with_spots AS
SELECT
  a.*,
  GREATEST(a.max_participants - a.current_participants, 0) AS spots_left,
  (a.is_boosted AND (a.boost_end_at IS NULL OR a.boost_end_at > now())) AS is_currently_boosted
FROM public.activities a;

-- ---------- 7. Auto-expire boosts (called by edge cron or on read) ----------
CREATE OR REPLACE FUNCTION public.expire_old_boosts()
RETURNS int AS $$
DECLARE
  affected int;
BEGIN
  UPDATE public.activities
  SET is_boosted = false,
      updated_at = now()
  WHERE is_boosted = true
    AND boost_end_at IS NOT NULL
    AND boost_end_at <= now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
