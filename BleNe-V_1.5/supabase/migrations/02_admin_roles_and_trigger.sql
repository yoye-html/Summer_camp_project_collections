
-- Add new columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS admin_notes text;

-- Update constraints
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('visually_impaired', 'volunteer', 'admin'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'approved', 'rejected'));

-- Update RLS policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;

-- 1. Users can read their own profile
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);

-- 2. Authenticated users can read approved profiles (needed for request matching names)
CREATE POLICY "Authenticated users can view approved profiles" ON public.users FOR SELECT USING (
  auth.role() = 'authenticated' AND status = 'approved'
);

-- 3. Admins can view/update all
CREATE POLICY "Admins can view all profiles" ON public.users FOR SELECT USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

CREATE POLICY "Admins can update all profiles" ON public.users FOR UPDATE USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- 4. Users can update their own profile
-- (Already exists: "Users can update own profile", but refreshing to be safe)
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);


-- TRIGGER for Automatic User Creation
-- This solves the RLS insert issue by bypassing the client and doing it on the server side
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
  v_name text;
  v_status text;
BEGIN
  v_role := new.raw_user_meta_data->>'role';
  v_name := new.raw_user_meta_data->>'name';
  
  -- Determine initial status
  IF v_role = 'visually_impaired' THEN
    v_status := 'approved';
  ELSE
    -- Volunteers and others start as pending
    v_status := 'pending';
  END IF;

  INSERT INTO public.users (id, email, name, role, status, membership_verified, stars)
  VALUES (
    new.id,
    new.email,
    COALESCE(v_name, 'New User'),
    COALESCE(v_role, 'visually_impaired'),
    v_status,
    CASE WHEN v_role = 'volunteer' THEN true ELSE false END, -- Assuming verification code passed in client means verified association
    0
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
