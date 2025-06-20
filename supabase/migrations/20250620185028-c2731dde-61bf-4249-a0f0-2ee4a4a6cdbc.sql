
-- Fix the overly permissive RLS policies on the subscribers table

-- Drop existing problematic policies
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

-- Create secure policies that properly restrict access
CREATE POLICY "users_can_update_own_subscription" ON public.subscribers
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_can_insert_subscription" ON public.subscribers
FOR INSERT
WITH CHECK (true);

-- Tighten the select policy to only use user_id for better security
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;
CREATE POLICY "users_can_select_own_subscription" ON public.subscribers
FOR SELECT
USING (user_id = auth.uid());

-- Add DELETE policy for proper data cleanup
CREATE POLICY "users_can_delete_own_subscription" ON public.subscribers
FOR DELETE
USING (user_id = auth.uid());

-- Fix user_usage table RLS policies as well
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Create secure policies for user_usage table
CREATE POLICY "users_can_select_own_usage" ON public.user_usage
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "users_can_update_own_usage" ON public.user_usage
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_can_manage_usage" ON public.user_usage
FOR ALL
USING (true)
WITH CHECK (true);

-- Add RLS policies for detection_history table
ALTER TABLE public.detection_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_select_own_detection_history" ON public.detection_history
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "users_can_insert_own_detection_history" ON public.detection_history
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Add RLS policies for profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_select_own_profile" ON public.profiles
FOR SELECT
USING (id = auth.uid());

CREATE POLICY "users_can_update_own_profile" ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "service_role_can_manage_profiles" ON public.profiles
FOR ALL
USING (true)
WITH CHECK (true);
