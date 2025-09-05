
-- Update all existing women users to have VIP subscription privileges
UPDATE public.subscribers 
SET 
  subscription_tier = 'vip',
  subscribed = true,
  subscription_end = now() + interval '10 years',
  updated_at = now()
WHERE email IN (
  SELECT email 
  FROM auth.users 
  WHERE id IN (
    SELECT id 
    FROM public.profiles 
    WHERE gender = 'female'
  )
);

-- For women users who don't have a subscriber record yet, create one with VIP privileges
INSERT INTO public.subscribers (user_id, email, subscription_tier, subscribed, subscription_end, updated_at, created_at)
SELECT 
  p.id,
  u.email,
  'vip',
  true,
  now() + interval '10 years',
  now(),
  now()
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.gender = 'female'
AND NOT EXISTS (
  SELECT 1 FROM public.subscribers s WHERE s.email = u.email
);
