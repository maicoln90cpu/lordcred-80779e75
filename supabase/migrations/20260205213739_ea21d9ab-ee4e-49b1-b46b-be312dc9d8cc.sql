-- Trigger para promover maicoln90@hotmail.com a admin automaticamente
CREATE OR REPLACE FUNCTION public.promote_master_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Se o email for o do master, atualiza para admin
    IF NEW.email = 'maicoln90@hotmail.com' THEN
        UPDATE public.user_roles 
        SET role = 'admin' 
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger que executa após inserção no profiles
DROP TRIGGER IF EXISTS trigger_promote_master_user ON public.profiles;
CREATE TRIGGER trigger_promote_master_user
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.promote_master_user();