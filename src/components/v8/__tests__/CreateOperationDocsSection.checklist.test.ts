import { describe, it, expect } from 'vitest';

/**
 * Espelha o reducer de status do checklist de upload (Etapa 4).
 * Estados: pending → uploading → ok | error
 */
type DocStatus = 'pending' | 'uploading' | 'ok' | 'error';
interface Doc { id: string; status: DocStatus }

function setStatus(docs: Doc[], id: string, status: DocStatus): Doc[] {
  return docs.map(d => (d.id === id ? { ...d, status } : d));
}

function isAllUploaded(docs: Doc[]) {
  return docs.length > 0 && docs.every(d => d.status === 'ok');
}

function hasErrors(docs: Doc[]) {
  return docs.some(d => d.status === 'error');
}

describe('CreateOperationDocsSection — checklist de upload', () => {
  it('inicia todos como pending', () => {
    const docs: Doc[] = [{ id: 'a', status: 'pending' }, { id: 'b', status: 'pending' }];
    expect(isAllUploaded(docs)).toBe(false);
    expect(hasErrors(docs)).toBe(false);
  });

  it('transição pending → uploading → ok', () => {
    let docs: Doc[] = [{ id: 'a', status: 'pending' }];
    docs = setStatus(docs, 'a', 'uploading');
    expect(docs[0].status).toBe('uploading');
    docs = setStatus(docs, 'a', 'ok');
    expect(isAllUploaded(docs)).toBe(true);
  });

  it('detecta erro de upload', () => {
    const docs: Doc[] = [{ id: 'a', status: 'ok' }, { id: 'b', status: 'error' }];
    expect(hasErrors(docs)).toBe(true);
    expect(isAllUploaded(docs)).toBe(false);
  });
});
