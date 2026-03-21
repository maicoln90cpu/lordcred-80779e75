

## Correção: Importador de Leads não lê planilha exportada

### Causa raiz
Os headers da planilha exportada pelo sistema (`Nome`, `Telefone`, `Valor Lib.`, `Banco Nome`, `Parcela`, `Data Nasc.`, `Banco Código`, `Agência`, `Data Ref.`) **não batem** com os headers hardcoded no importador (`NOME`, `TELEFONE`, `VALOR LIB`, `BANCO_NOME`, `VLR PARCELA`, `DATA NASC`, `BANCO`, `AGENCIA`, `DATA`).

Como nenhum campo "NOME" é encontrado, todos os leads ficam com `nome = ''` e são filtrados pelo `.filter(p => p.nome.trim() !== '')`, resultando em 0 leads e sem botão de importar.

### Solução
Normalizar os headers para lowercase no parse e usar uma função `get()` que tenta múltiplas variantes de cada header:

**Arquivo**: `src/components/admin/LeadImporter.tsx` (linhas 115-139)

1. Após `sheet_to_json`, normalizar todas as keys para lowercase
2. Criar função `get(row, ...possibleKeys)` que busca o primeiro match
3. Mapear cada campo com todas as variantes conhecidas:
   - `nome`: `NOME`, `Nome`
   - `telefone`: `TELEFONE`, `Telefone`
   - `valor_lib`: `VALOR LIB`, `Valor Lib.`, `Valor Lib`
   - `vlr_parcela`: `VLR PARCELA`, `Parcela`
   - `banco_nome`: `BANCO_NOME`, `Banco Nome`
   - `banco_codigo`: `BANCO`, `Banco Código`
   - `data_nasc`: `DATA NASC`, `Data Nasc.`
   - `data_ref`: `DATA`, `Data Ref.`, `Data Ref`
   - `agencia`: `AGENCIA`, `Agência`
   - `nome_mae`: `NOME_MAE`, `Nome Mãe`

### Resultado esperado
Tanto planilhas no formato original (headers maiúsculos) quanto planilhas exportadas pelo próprio sistema serão importadas corretamente.

