
-- Delete ALL existing CLT rules (wrong data + duplicated 2026-03-24)
DELETE FROM cr_rules_clt;

-- Insert exact 53 rules from reference spreadsheet (vigência 2025-01-01)

-- MERCANTIL (1)
INSERT INTO cr_rules_clt (data_vigencia, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa) VALUES
('2025-01-01', 'MERCANTIL', 'Normal/Padrão', 'Ambos', 1, 99, 6.0);

-- FACTA (2)
INSERT INTO cr_rules_clt (data_vigencia, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa) VALUES
('2025-01-01', 'FACTA', 'GOLD', 'Ambos', 12, 20, 6.6),
('2025-01-01', 'FACTA', 'GOLD', 'Ambos', 24, 48, 7.6);

-- V8 Bank (4)
INSERT INTO cr_rules_clt (data_vigencia, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa) VALUES
('2025-01-01', 'V8 Bank', 'Acelera', 'Ambos', 6, 10, 5.0),
('2025-01-01', 'V8 Bank', 'Acelera', 'Ambos', 12, 18, 6.0),
('2025-01-01', 'V8 Bank', 'Acelera', 'Ambos', 24, 24, 7.5),
('2025-01-01', 'V8 Bank', 'Acelera', 'Ambos', 36, 36, 8.5);

-- Presença Bank (4)
INSERT INTO cr_rules_clt (data_vigencia, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa) VALUES
('2025-01-01', 'Presença Bank', 'Privado CLT', 'Ambos', 6, 6, 6.5),
('2025-01-01', 'Presença Bank', 'Privado CLT', 'Ambos', 12, 12, 8.5),
('2025-01-01', 'Presença Bank', 'Privado CLT', 'Ambos', 24, 24, 9.0),
('2025-01-01', 'Presença Bank', 'Privado CLT', 'Ambos', 36, 36, 9.5);

-- Hub Credito (5)
INSERT INTO cr_rules_clt (data_vigencia, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa) VALUES
('2025-01-01', 'Hub Credito', 'SONHO DO CLT', 'Ambos', 1, 99, 6.5),
('2025-01-01', 'Hub Credito', 'FOCO NO CORBAN', 'Ambos', 1, 99, 5.0),
('2025-01-01', 'Hub Credito', 'CARTADA CLT', 'Ambos', 1, 99, 4.5),
('2025-01-01', 'Hub Credito', '36X COM SEGURO', 'Ambos', 36, 36, 5.0),
('2025-01-01', 'Hub Credito', 'CONSIGNADO CLT 48x', 'Ambos', 48, 48, 5.0);

-- Prata Digital (4)
INSERT INTO cr_rules_clt (data_vigencia, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa) VALUES
('2025-01-01', 'Prata Digital', 'CELCOIN', 'Ambos', 1, 99, 7.5),
('2025-01-01', 'Prata Digital', 'QITECH', 'Ambos', 6, 6, 5.5),
('2025-01-01', 'Prata Digital', 'QITECH', 'Ambos', 12, 12, 6.5),
('2025-01-01', 'Prata Digital', 'QITECH', 'Ambos', 24, 36, 10.5);

-- Happy Consig (8)
INSERT INTO cr_rules_clt (data_vigencia, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa) VALUES
('2025-01-01', 'Happy Consig', 'Padrão', 'Não', 12, 12, 1.1),
('2025-01-01', 'Happy Consig', 'Padrão', 'Não', 18, 18, 2.0),
('2025-01-01', 'Happy Consig', 'Padrão', 'Não', 24, 24, 2.8),
('2025-01-01', 'Happy Consig', 'Padrão', 'Não', 36, 36, 4.0),
('2025-01-01', 'Happy Consig', 'Com Seguro', 'Sim', 12, 12, 2.15),
('2025-01-01', 'Happy Consig', 'Com Seguro', 'Sim', 18, 18, 3.6),
('2025-01-01', 'Happy Consig', 'Com Seguro', 'Sim', 24, 24, 4.5),
('2025-01-01', 'Happy Consig', 'Com Seguro', 'Sim', 36, 36, 7.5);

-- Zilicred (6)
INSERT INTO cr_rules_clt (data_vigencia, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa) VALUES
('2025-01-01', 'Zilicred', 'Com Seguro', 'Sim', 1, 99, 5.8),
('2025-01-01', 'Zilicred', 'Sem Seguro', 'Não', 1, 1, 3.5),
('2025-01-01', 'Zilicred', 'Sem Seguro', 'Não', 6, 12, 2.5),
('2025-01-01', 'Zilicred', 'Sem Seguro', 'Não', 18, 18, 3.0),
('2025-01-01', 'Zilicred', 'Sem Seguro', 'Não', 24, 24, 3.5),
('2025-01-01', 'Zilicred', 'Sem Seguro', 'Não', 38, 48, 4.0);

-- Banco C6 (15)
INSERT INTO cr_rules_clt (data_vigencia, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa) VALUES
('2025-01-01', 'Banco C6', 'Geral', 'Ambos', 6, 6, 3.0),
('2025-01-01', 'Banco C6', 'Normal', 'Não', 12, 12, 4.0),
('2025-01-01', 'Banco C6', 'Normal', 'Não', 18, 18, 4.5),
('2025-01-01', 'Banco C6', 'Normal', 'Não', 24, 24, 5.0),
('2025-01-01', 'Banco C6', 'Normal', 'Não', 36, 48, 5.5),
('2025-01-01', 'Banco C6', 'Seguro 2 Parcelas', 'Sim', 12, 12, 4.0),
('2025-01-01', 'Banco C6', 'Seguro 2 Parcelas', 'Sim', 18, 18, 4.8),
('2025-01-01', 'Banco C6', 'Seguro 2 Parcelas', 'Sim', 24, 24, 5.3),
('2025-01-01', 'Banco C6', 'Seguro 2 Parcelas', 'Sim', 36, 36, 5.8),
('2025-01-01', 'Banco C6', 'Seguro 2 Parcelas', 'Sim', 48, 48, 6.3),
('2025-01-01', 'Banco C6', 'Seguro 4 Parcela', 'Sim', 12, 12, 4.3),
('2025-01-01', 'Banco C6', 'Seguro 4 Parcela', 'Sim', 18, 18, 5.3),
('2025-01-01', 'Banco C6', 'Seguro 4 Parcela', 'Sim', 24, 24, 5.8),
('2025-01-01', 'Banco C6', 'Seguro 4 Parcela', 'Sim', 36, 36, 6.3),
('2025-01-01', 'Banco C6', 'Seguro 4 Parcela', 'Sim', 48, 48, 6.8);

-- Qualibank (4)
INSERT INTO cr_rules_clt (data_vigencia, banco, tabela_chave, seguro, prazo_min, prazo_max, taxa) VALUES
('2025-01-01', 'Qualibank', 'Geral', 'Ambos', 6, 6, 5.0),
('2025-01-01', 'Qualibank', 'Vendas', 'Ambos', 12, 12, 6.5),
('2025-01-01', 'Qualibank', 'Geral', 'Ambos', 18, 18, 7.5),
('2025-01-01', 'Qualibank', 'Geral', 'Ambos', 24, 24, 8.5);
