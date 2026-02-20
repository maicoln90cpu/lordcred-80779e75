-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table (following security best practices)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT NOT NULL,
    name TEXT,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chips table (WhatsApp instances)
CREATE TABLE public.chips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    slot_number INTEGER NOT NULL CHECK (slot_number >= 1 AND slot_number <= 5),
    instance_name TEXT NOT NULL,
    phone_number TEXT,
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting')),
    activated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, slot_number)
);

-- Create message_history table
CREATE TABLE public.message_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chip_id UUID REFERENCES public.chips(id) ON DELETE CASCADE NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
    message_content TEXT NOT NULL,
    recipient_phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create warming_messages table (predefined messages for warming)
CREATE TABLE public.warming_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create system_settings table
CREATE TABLE public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warming_mode TEXT NOT NULL DEFAULT 'same_user' CHECK (warming_mode IN ('same_user', 'between_users', 'external')),
    start_hour INTEGER NOT NULL DEFAULT 8 CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour INTEGER NOT NULL DEFAULT 20 CHECK (end_hour >= 0 AND end_hour <= 23),
    messages_day_1_3 INTEGER NOT NULL DEFAULT 20,
    messages_day_4_7 INTEGER NOT NULL DEFAULT 50,
    messages_day_8_plus INTEGER NOT NULL DEFAULT 100,
    min_interval_seconds INTEGER NOT NULL DEFAULT 60,
    max_interval_seconds INTEGER NOT NULL DEFAULT 300,
    is_warming_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warming_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_admin());

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin());

-- RLS Policies for chips
CREATE POLICY "Users can view their own chips"
ON public.chips FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all chips"
ON public.chips FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Users can manage their own chips"
ON public.chips FOR ALL
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all chips"
ON public.chips FOR ALL
TO authenticated
USING (public.is_admin());

-- RLS Policies for message_history
CREATE POLICY "Users can view their own messages"
ON public.message_history FOR SELECT
TO authenticated
USING (
    chip_id IN (
        SELECT id FROM public.chips WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all messages"
ON public.message_history FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "System can insert messages"
ON public.message_history FOR INSERT
TO authenticated
WITH CHECK (
    chip_id IN (
        SELECT id FROM public.chips WHERE user_id = auth.uid()
    ) OR public.is_admin()
);

-- RLS Policies for warming_messages (admin only)
CREATE POLICY "Admins can manage warming messages"
ON public.warming_messages FOR ALL
TO authenticated
USING (public.is_admin());

CREATE POLICY "Authenticated users can read warming messages"
ON public.warming_messages FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for system_settings (admin only)
CREATE POLICY "Admins can manage system settings"
ON public.system_settings FOR ALL
TO authenticated
USING (public.is_admin());

CREATE POLICY "Authenticated users can read system settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (true);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chips_updated_at
    BEFORE UPDATE ON public.chips
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default system settings
INSERT INTO public.system_settings (warming_mode, start_hour, end_hour, messages_day_1_3, messages_day_4_7, messages_day_8_plus)
VALUES ('same_user', 8, 20, 20, 50, 100);