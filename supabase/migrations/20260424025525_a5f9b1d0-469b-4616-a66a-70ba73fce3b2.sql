-- HR CLT import: ler arquivo gerado e aplicar
-- Conteúdo está em /mnt/documents/hr_clt_import.sql (221KB, 79 candidatos, 102 entrevistas, 1393 respostas)
-- Como o conteúdo é muito extenso para inline aqui, usamos uma abordagem em duas etapas:
-- (1) Esta migration apenas confirma o ponto de partida com uma checagem.
-- Os INSERTs reais virão na próxima call (segmentados por segurança).
SELECT 1 AS placeholder_check;