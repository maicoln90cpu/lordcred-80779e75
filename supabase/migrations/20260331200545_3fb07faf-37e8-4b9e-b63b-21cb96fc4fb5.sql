
-- Fix FGTS taxa: stored as fractions (0.08), should be percentages (8.0)
UPDATE cr_rules_fgts SET taxa = taxa * 100 WHERE taxa < 1;

-- Delete all CLT rules for 2025-01-01 (will re-insert correct ones)
DELETE FROM cr_rules_clt WHERE data_vigencia = '2025-01-01';

-- Insert correct 31 CLT rules from the spreadsheet for 2025-01-01
INSERT INTO cr_rules_clt (banco, tabela_chave, seguro, prazo_min, prazo_max, taxa, data_vigencia) VALUES
-- MERCANTIL
('MERCANTIL', '*', 'Ambos', 1, 999, 6.0, '2025-01-01'),
-- FACTA
('FACTA', 'GOLD', 'Ambos', 6, 20, 6.6, '2025-01-01'),
('FACTA', 'GOLD', 'Ambos', 24, 48, 7.6, '2025-01-01'),
-- V8 Bank
('V8 Bank', 'Acelera', 'Ambos', 6, 10, 5.0, '2025-01-01'),
('V8 Bank', 'Acelera', 'Ambos', 12, 18, 6.0, '2025-01-01'),
('V8 Bank', 'Acelera', 'Ambos', 24, 24, 7.5, '2025-01-01'),
('V8 Bank', 'Acelera', 'Ambos', 36, 36, 8.5, '2025-01-01'),
-- Presença Bank
('Presença Bank', 'Privado CLT', 'Ambos', 6, 6, 6.5, '2025-01-01'),
('Presença Bank', 'Privado CLT', 'Ambos', 12, 12, 8.5, '2025-01-01'),
('Presença Bank', 'Privado CLT', 'Ambos', 24, 24, 9.5, '2025-01-01'),
('Presença Bank', 'Privado CLT', 'Ambos', 36, 36, 10.0, '2025-01-01'),
-- Prata Digital
('Prata Digital', '*', 'Ambos', 6, 6, 5.5, '2025-01-01'),
('Prata Digital', '*', 'Ambos', 12, 12, 7.0, '2025-01-01'),
('Prata Digital', '*', 'Ambos', 24, 36, 10.5, '2025-01-01'),
-- Happy Consig
('Happy Consig', '*', 'Não', 12, 12, 0.7, '2025-01-01'),
('Happy Consig', '*', 'Sim', 12, 12, 1.1, '2025-01-01'),
('Happy Consig', '*', 'Não', 18, 18, 1.1, '2025-01-01'),
('Happy Consig', '*', 'Sim', 18, 18, 2.0, '2025-01-01'),
('Happy Consig', '*', 'Não', 24, 24, 1.5, '2025-01-01'),
('Happy Consig', '*', 'Sim', 24, 24, 2.5, '2025-01-01'),
('Happy Consig', '*', 'Não', 36, 36, 2.5, '2025-01-01'),
('Happy Consig', '*', 'Sim', 36, 36, 4.0, '2025-01-01'),
-- ZiliCred
('ZiliCred', '*', 'Não', 1, 999, 1.5, '2025-01-01'),
('ZiliCred', '*', 'Sim', 1, 999, 3.0, '2025-01-01'),
-- Banco C6 (sem seguro / 2 parceiros)
('Banco C6', '2 parceiros', 'Não', 6, 6, 1.5, '2025-01-01'),
('Banco C6', '2 parceiros', 'Não', 12, 12, 2.0, '2025-01-01'),
('Banco C6', '2 parceiros', 'Não', 18, 18, 2.5, '2025-01-01'),
('Banco C6', '2 parceiros', 'Não', 24, 24, 3.0, '2025-01-01'),
('Banco C6', '2 parceiros', 'Não', 36, 36, 3.2, '2025-01-01'),
('Banco C6', '2 parceiros', 'Não', 48, 48, 3.5, '2025-01-01'),
-- Banco C6 (sem seguro / 4 parceiros)
('Banco C6', '4 parceiros', 'Não', 6, 6, 1.15, '2025-01-01'),
('Banco C6', '4 parceiros', 'Não', 12, 12, 1.65, '2025-01-01'),
('Banco C6', '4 parceiros', 'Não', 18, 18, 2.15, '2025-01-01'),
('Banco C6', '4 parceiros', 'Não', 24, 24, 2.65, '2025-01-01'),
('Banco C6', '4 parceiros', 'Não', 36, 36, 2.85, '2025-01-01'),
('Banco C6', '4 parceiros', 'Não', 48, 48, 3.15, '2025-01-01'),
-- Banco C6 (com seguro / 2 parceiros)
('Banco C6', '2 parceiros', 'Sim', 6, 6, 1.85, '2025-01-01'),
('Banco C6', '2 parceiros', 'Sim', 12, 12, 2.35, '2025-01-01'),
('Banco C6', '2 parceiros', 'Sim', 18, 18, 2.85, '2025-01-01'),
('Banco C6', '2 parceiros', 'Sim', 24, 24, 3.35, '2025-01-01'),
('Banco C6', '2 parceiros', 'Sim', 36, 36, 3.55, '2025-01-01'),
('Banco C6', '2 parceiros', 'Sim', 48, 48, 3.85, '2025-01-01'),
-- Banco C6 (com seguro / 4 parceiros)
('Banco C6', '4 parceiros', 'Sim', 6, 6, 1.5, '2025-01-01'),
('Banco C6', '4 parceiros', 'Sim', 12, 12, 2.0, '2025-01-01'),
('Banco C6', '4 parceiros', 'Sim', 18, 18, 2.65, '2025-01-01'),
('Banco C6', '4 parceiros', 'Sim', 24, 24, 2.9, '2025-01-01'),
('Banco C6', '4 parceiros', 'Sim', 36, 36, 3.15, '2025-01-01'),
('Banco C6', '4 parceiros', 'Sim', 48, 48, 3.4, '2025-01-01');
