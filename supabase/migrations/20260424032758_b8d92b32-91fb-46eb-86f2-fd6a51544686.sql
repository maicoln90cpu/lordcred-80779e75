-- 1) Importar 18 leads parceiros
INSERT INTO public.hr_partner_leads (full_name, phone, age, cpf, interview_date, observations, meeting_status, sent_link, accepted, mei_informed, mei_created, acquisition_source, referred_by) VALUES
('Rafaella Correia dos Santos', '48998525435', 20, '09103913945', '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Incluir na próxima', 'called', FALSE, FALSE, FALSE, NULL, 'interview', NULL),
('Mosia Costa', '6291186765', 21, '03774284261', '2026-03-10T00:00:00-03:00'::timestamptz, NULL, 'called', FALSE, FALSE, FALSE, NULL, 'interview', NULL),
('Gustavo Barcelos da Silva', '4891663249', 22, '13394326922', '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Sim | MEI: Sim', 'called', TRUE, TRUE, TRUE, NULL, 'interview', NULL),
('Silvio de Melo', '4898004455', 53, '11159660816', '2026-03-10T00:00:00-03:00'::timestamptz, 'Disponivel após as 18hrs | MEI: Sim', 'called', FALSE, FALSE, TRUE, NULL, 'referral', 'Ivanilda'),
('Yago de Oliveira', '6892240643', 19, '13852109906', '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Sim | MEI: Sim', 'called', TRUE, TRUE, TRUE, NULL, 'interview', NULL),
('João Lucas Mafra da Silva', '4896753151', 21, NULL, '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Sim | MEI: Sim', 'called', TRUE, TRUE, TRUE, NULL, 'interview', NULL),
('José Nilton Dias Moreira', '4896893791', 50, '58143386287', '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Incluir na próxima', 'called', FALSE, FALSE, FALSE, NULL, 'interview', NULL),
('Priscila Santana de Ramos', '4998281494', 31, NULL, '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Sim | MEI: Sim', 'called', TRUE, TRUE, TRUE, 'Aguardando criação', 'interview', NULL),
('Giovanna Plaza Pereira', '11934015077', 23, '45939120830', '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Sim | MEI: Questionei interesse', 'called', TRUE, FALSE, TRUE, NULL, 'interview', NULL),
('Miguel Santos', '91984250060', 21, '10123821258', '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Sim | MEI: Sim', 'called', TRUE, TRUE, TRUE, NULL, 'interview', NULL),
('Douglas Padilha dos Santos', '4896855236', 18, '12300557975', '2026-03-10T00:00:00-03:00'::timestamptz, NULL, 'called', FALSE, FALSE, FALSE, NULL, 'interview', NULL),
('Ana Luiza Venancio Ferreira', '4899885993', 18, '13830652925', '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Incluir na próxima', 'called', FALSE, FALSE, FALSE, NULL, 'interview', NULL),
('Joana Adelaide Lopes', '4896400816', 22, '08843867911', '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Sim | MEI: Sim', 'called', TRUE, TRUE, TRUE, NULL, 'interview', NULL),
('Flavia Renata Silva dos anjos', '6792920563', 30, '05911379171', '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Incluir na próxima', 'called', FALSE, FALSE, FALSE, NULL, 'interview', NULL),
('Emilly Lauren Meireles de Moura', '4888778405', 21, '13835706985', '2026-03-10T00:00:00-03:00'::timestamptz, 'Reunião: Sim | MEI: Sim', 'called', TRUE, FALSE, TRUE, '64.569.826/0001-59', 'interview', NULL),
('Alice', '7583121913', 23, NULL, '2026-03-10T00:00:00-03:00'::timestamptz, NULL, 'called', FALSE, FALSE, FALSE, NULL, 'interview', NULL),
('Laura', '4899518748', 19, NULL, '2026-03-10T00:00:00-03:00'::timestamptz, NULL, 'called', FALSE, FALSE, FALSE, NULL, 'interview', NULL),
('Helita', '00000000000', NULL, NULL, NULL::timestamptz, '[TELEFONE PENDENTE - revisar] Reunião: Sim | MEI: Sim', 'called', TRUE, TRUE, TRUE, NULL, 'interview', NULL)
ON CONFLICT DO NOTHING;

-- 2) Habilitar Realtime para tabelas HR
ALTER TABLE public.hr_candidates REPLICA IDENTITY FULL;
ALTER TABLE public.hr_partner_leads REPLICA IDENTITY FULL;
ALTER TABLE public.hr_interviews REPLICA IDENTITY FULL;
ALTER TABLE public.hr_interview_answers REPLICA IDENTITY FULL;

-- Adicionar à publicação supabase_realtime (idempotente)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_candidates;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_partner_leads;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_interviews;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hr_interview_answers;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;