
-- Grant VIP subscription to the specific user
UPDATE public.subscribers 
SET 
  subscription_tier = 'vip',
  subscribed = true,
  subscription_end = now() + interval '10 years',
  updated_at = now()
WHERE email = 'zevedeos6@gmail.com';

-- If the user doesn't have a subscriber record yet, create one with VIP privileges
INSERT INTO public.subscribers (user_id, email, subscription_tier, subscribed, subscription_end, updated_at, created_at)
SELECT 
  u.id,
  'zevedeos6@gmail.com',
  'vip',
  true,
  now() + interval '10 years',
  now(),
  now()
FROM auth.users u
WHERE u.email = 'zevedeos6@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.subscribers s WHERE s.email = 'zevedeos6@gmail.com'
);
