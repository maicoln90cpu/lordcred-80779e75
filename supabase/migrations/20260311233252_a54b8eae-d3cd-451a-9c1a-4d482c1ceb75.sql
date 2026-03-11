-- Normalize existing custom_status values to match kanban column names
UPDATE conversations SET custom_status = 'Aguardando' WHERE custom_status = 'aguardando';
UPDATE conversations SET custom_status = 'Em andamento' WHERE custom_status = 'em_andamento';
UPDATE conversations SET custom_status = 'Finalizado' WHERE custom_status = 'finalizado';
UPDATE conversations SET custom_status = 'Urgente' WHERE custom_status = 'urgente';