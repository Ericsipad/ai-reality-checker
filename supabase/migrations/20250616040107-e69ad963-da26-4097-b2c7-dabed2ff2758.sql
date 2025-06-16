
-- Add email column to user_usage table
ALTER TABLE public.user_usage ADD COLUMN email TEXT;

-- Update the existing trigger function to also insert the email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  INSERT INTO public.user_usage (user_id, email, checks_used, total_checks, last_reset)
  VALUES (NEW.id, NEW.email, 0, 5, NOW());
  
  INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, remaining_checks)
  VALUES (NEW.id, NEW.email, false, NULL, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing records to populate the email column
UPDATE public.user_usage 
SET email = (
  SELECT email 
  FROM public.profiles 
  WHERE profiles.id = user_usage.user_id
)
WHERE email IS NULL;
