
-- First, delete all chat messages related to this user
DELETE FROM public.chat_messages 
WHERE chat_room_id IN (
  SELECT id FROM public.chat_rooms 
  WHERE user1_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47' 
     OR user2_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47'
);

-- Delete chat rooms where this user is involved
DELETE FROM public.chat_rooms 
WHERE user1_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47' 
   OR user2_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete connection requests
DELETE FROM public.connection_requests 
WHERE sender_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47' 
   OR receiver_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete connections
DELETE FROM public.connections 
WHERE user1_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47' 
   OR user2_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete matches
DELETE FROM public.matches 
WHERE user1_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47' 
   OR user2_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete swipes
DELETE FROM public.swipes 
WHERE swiper_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47' 
   OR swiped_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete user favorites
DELETE FROM public.user_favorites 
WHERE user_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47' 
   OR favorited_user_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete friends
DELETE FROM public.friends 
WHERE user_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47' 
   OR friend_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete blocked users
DELETE FROM public.blocked_users 
WHERE blocker_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47' 
   OR blocked_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete stories and related data
DELETE FROM public.story_likes WHERE user_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';
DELETE FROM public.story_comments WHERE user_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';
DELETE FROM public.stories WHERE user_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete verification requests
DELETE FROM public.verification_requests WHERE user_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete subscriber record
DELETE FROM public.subscribers WHERE user_id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';

-- Delete profile (this should cascade delete the auth user due to the foreign key)
DELETE FROM public.profiles WHERE id = '3a765ea5-8eb2-487c-9631-43dc930e2e47';
