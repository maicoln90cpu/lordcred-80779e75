
-- system_settings: permitir UPDATE para autenticados
CREATE POLICY "Authenticated users can update system settings"
ON public.system_settings FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

-- warming_messages: permitir INSERT/DELETE para autenticados
CREATE POLICY "Authenticated users can insert warming messages"
ON public.warming_messages FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete warming messages"
ON public.warming_messages FOR DELETE TO authenticated
USING (true);

-- external_numbers: permitir INSERT/UPDATE/DELETE para autenticados
CREATE POLICY "Authenticated users can insert external numbers"
ON public.external_numbers FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update external numbers"
ON public.external_numbers FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete external numbers"
ON public.external_numbers FOR DELETE TO authenticated
USING (true);
