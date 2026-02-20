
-- Administradores (role=user) podem ver perfis que criaram
CREATE POLICY "Users can view profiles they created"
ON public.profiles FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Administradores podem atualizar perfis que criaram
CREATE POLICY "Users can update profiles they created"
ON public.profiles FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Administradores podem ver roles dos usuarios que criaram
CREATE POLICY "Users can view roles of created users"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id IN (
  SELECT p.user_id FROM profiles p WHERE p.created_by = auth.uid()
));

-- Administradores podem ver chips dos usuarios que criaram
CREATE POLICY "Users can view chips of created users"
ON public.chips FOR SELECT
TO authenticated
USING (user_id IN (
  SELECT p.user_id FROM profiles p WHERE p.created_by = auth.uid()
));
