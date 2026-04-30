/**
 * Helper para carregar a biblioteca xlsx (~900KB) sob demanda.
 *
 * Por que existe:
 * - `import * as XLSX from 'xlsx'` em arquivos do projeto faz o Vite incluir
 *   a lib inteira no bundle inicial de qualquer rota que toque esses arquivos.
 * - Importar dinamicamente faz o Vite criar um chunk separado que só baixa
 *   quando o usuário REALMENTE clica em "Importar" / "Exportar planilha".
 *
 * Como usar:
 *   import { loadXLSX } from '@/lib/xlsx-lazy';
 *   const XLSX = await loadXLSX();
 *   const wb = XLSX.read(data, { type: 'array' });
 */

// Cache do módulo para não baixar duas vezes na mesma sessão.
let cached: typeof import('xlsx') | null = null;
let pending: Promise<typeof import('xlsx')> | null = null;

export async function loadXLSX(): Promise<typeof import('xlsx')> {
  if (cached) return cached;
  if (pending) return pending;
  pending = import('xlsx').then((mod) => {
    // O módulo xlsx exporta tudo no namespace; alguns ambientes retornam .default
    cached = (mod as any).default ?? mod;
    pending = null;
    return cached!;
  });
  return pending;
}
