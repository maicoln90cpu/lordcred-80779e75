
-- Insert partners from XLSX data
INSERT INTO public.partners (nome, cpf, telefone, email, nacionalidade, estado_civil, endereco, cnpj, razao_social, endereco_pj, pix_pj, pipeline_status, contrato_status, indicado_por)
VALUES
  ('Helida Oliveira Ramos', '07551244131', '48992099068', 'helidaoliver674@gmail.com', 'Brasileira', 'Solteira', 'Carlos Wengartner 219 Palhoça Centro CEP 88131440', '66.100.505/0001-36', '66.100.505 Helida Oliveira Ramos', 'Carlos Wengartner 219 Palhoça Centro CEP 88131440', '66.100.505/0001-36', 'contrato_pendente', 'pendente', 'Ryan Oliveira Ramos'),
  ('Ryan Oliveira Ramos', '07551227121', '48991951454', 'ryanoliveira.0tdl@gmail.com', 'Brasileiro', 'Solteiro', 'Rua Daniel Carlos Weingartner 219 - 88134-292', '66.095.338/0001-90', '66.095.338 Ryan Oliveira Ramos', 'Rua Daniel Carlos Weingartner 219 - 88134-292', '66.095.338/0001-90', 'contrato_assinado', 'assinado', NULL),
  ('Queite Oliveira de Souza', '78095883115', '48991559402', 'keytholiver11@gmail.com', 'Brasileira', 'Solteira', 'Carlos Wengartner 219 Palhoça Centro CEP 88131440', '61.919.579/0001-85', '61.919.579 Queite Oliveira de Souza', 'Carlos Wengartner 219 Palhoça Centro CEP 88131440', '61919579000185', 'contrato_pendente', 'pendente', 'Ryan Oliveira Ramos'),
  ('Henrique de Souza D''Ávila', '86368931000', '48998158543', 'Henriquesdavila@gmail.com', 'Brasileiro', 'Solteiro', 'Valmir Hermelino Machado, 100, 1113A, Guarda do Cubatão, Palhoça SC - 88135338', '65.690.410/0001-57', 'Henrique de Souza D Avila', 'Valmir Hermelino Machado, 100, 1113A, Guarda do Cubatão, Palhoça SC - 88135338', '65690410000157', 'ativo', 'assinado', 'Filipi'),
  ('Emilly Lauren Meirelles de Moura', '13835706985', '48988778405', 'emillyvraal@gmail.com', 'Brasileira', 'Solteira', '88131400, Jacob Weingartner 4619 Centro de Palhoça', '64.569.826/0001-59', 'Emilly Lauren Meirelles de Moura', '88131400, Jacob Weingartner 4619 Centro de Palhoça', '64.569.826/0001-59', 'ativo', 'assinado', NULL),
  ('Gustavo Barcelos da Silva', '13394326922', '48991663249', 'bigbangustavo@gmail.com', 'Brasileiro', 'Solteiro', 'R. Elizeu di Bernardi, 639 - Campinas São José - SC, 88101-050', '65.721.825/0001-40', 'Gustavo Barcelos da Silva', 'R. Elizeu di Bernardi, 639 - Campinas São José - SC, 88101-050', '48991663249', 'ativo', 'assinado', NULL),
  ('Joana Adelaide Lopes', '08843867911', '48996400816', 'Joohalopes26@gmail.com', 'Brasileira', 'Solteira', 'R. Cristóvão Jaques, 252 - Barra do Aririu - Palhoça CEP 88134446', '65.627.258/0001-68', 'Joana Adelaide Lopes', 'R. Cristóvão Jaques, 252 - Barra do Aririu - Palhoça CEP 88134446', '65627258000168', 'ativo', 'assinado', NULL),
  ('Helita Freita Weneck', '95257535220', '48998427287', 'helitawerneck@gmail.com', 'Brasileira', 'Solteira', 'Rua Antônio Brasil Schroeder 103, Barreiros, São José-SC, CEP 88110-401', '48.269.069/0001-41', 'Helita Freita Weneck', 'Rua Doutor Heitor Blum 310 Sala 702 Estreito Florianópolis SC 88075-110', '48.269.069/0001-41', 'desistencia', 'assinado', NULL)
ON CONFLICT DO NOTHING;

-- Insert bank credentials from the image data
INSERT INTO public.bank_credentials (bank_name, username, password, link)
VALUES
  ('PARANA BANCO', 'LORDCRED', 'Lordcred@01', 'https://correspondente.paranabanco.com.br'),
  ('FRONT PARANA', 'LORDCRED', 'Lordcred@01', 'https://front.paranabanco.com.br'),
  ('LOTUS', 'silas.lordcred', 'Lordcred@01', 'https://app.lotusmais.com.br'),
  ('HUB', 'silas.lordcred', 'Lordcred@01', 'https://hub.lotusmais.com.br'),
  ('FACTA', '42824770', 'Lordcred@01', 'https://extranet.factafinanceira.com.br'),
  ('Presença Bank', 'LORDCRED', 'Lordcred@01', 'https://portal.presencabank.com.br'),
  ('V8', 'LORDCRED', 'Lordcred@01', 'https://v8digital.com.br'),
  ('PRATA', '42824770000107', 'Lordcred@01', 'https://portal.pratadigital.com.br'),
  ('C6', 'lordcred', 'Lordcred@01', 'https://correspondente.c6bank.com.br'),
  ('MERCANTIL SOLIDA', '42824770000107', 'Lordcred@01', 'https://solidacred.com.br'),
  ('MERCANTIL CONNECT', '42824770000107', 'Lordcred@01', 'https://connect.bancomercantil.com.br'),
  ('HAPPY', 'lordcred', 'Lordcred@01', 'https://app.happycred.com.br'),
  ('ZILICRED', 'lordcred', 'Lordcred@01', 'https://zilicred.com.br'),
  ('QUALIBANK', 'lordcred', 'Lordcred@01', 'https://portal.qualibank.com.br'),
  ('PAN', 'lordcred', 'Lordcred@01', 'https://correspondente.bancopan.com.br'),
  ('OLE', 'lordcred', 'Lordcred@01', 'https://portal.oleconsignado.com.br'),
  ('SAFRA', 'lordcred', 'Lordcred@01', 'https://correspondente.safra.com.br'),
  ('BMG', 'lordcred', 'Lordcred@01', 'https://parceiro.bmg.com.br')
ON CONFLICT DO NOTHING;
