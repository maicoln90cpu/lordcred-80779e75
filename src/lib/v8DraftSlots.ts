/**
 * Etapa 4 (Item 10): gerenciador de múltiplos rascunhos da Nova Simulação.
 * Migra automaticamente o rascunho legado (chave única `v8:nova-simulacao:draft`)
 * para o slot "Rascunho 1" do novo array.
 */

const LEGACY_KEY = 'v8:nova-simulacao:draft';
const STORAGE_KEY = 'v8:nova-simulacao:drafts:v2';
const ACTIVE_KEY = 'v8:nova-simulacao:active-slot';

export type SimulationMode = 'none' | 'disbursed_amount' | 'installment_face_value';
export interface V8DraftSlot {
  id: string;
  label: string;
  batchName: string;
  configId: string;
  parcelas: number;
  simulationMode: SimulationMode;
  simulationValue: string;
  pasteText: string;
  activeBatchId: string | null;
  /** Etapa 2 (abr/2026): modo "Auto-melhor" — tenta candidatos automaticamente. */
  autoBest?: boolean;
}

export function emptyDraft(label = 'Rascunho 1'): V8DraftSlot {
  return {
    id: crypto.randomUUID(),
    label,
    batchName: '',
    configId: '',
    parcelas: 24,
    simulationMode: 'none',
    simulationValue: '',
    pasteText: '',
    activeBatchId: null,
    // Etapa 1 (mai/2026): Auto-melhor agora é o padrão sempre ligado.
    // Decide sozinho a melhor combinação valor × prazo dentro da margem.
    autoBest: true,
  };
}

export function loadDrafts(): { drafts: V8DraftSlot[]; activeId: string } {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as V8DraftSlot[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const activeId = window.localStorage.getItem(ACTIVE_KEY) ?? parsed[0].id;
        return { drafts: parsed, activeId: parsed.find((d) => d.id === activeId) ? activeId : parsed[0].id };
      }
    }
    // Migração do formato legado.
    const legacy = typeof window !== 'undefined' ? window.localStorage.getItem(LEGACY_KEY) : null;
    if (legacy) {
      const lp = JSON.parse(legacy);
      const slot: V8DraftSlot = { ...emptyDraft('Rascunho 1'), ...lp };
      return { drafts: [slot], activeId: slot.id };
    }
  } catch { /* ignore */ }
  const fresh = emptyDraft('Rascunho 1');
  return { drafts: [fresh], activeId: fresh.id };
}

export function saveDrafts(drafts: V8DraftSlot[], activeId: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    window.localStorage.setItem(ACTIVE_KEY, activeId);
  } catch { /* ignore */ }
}

// --- Mapa auxiliar draftId <-> batchId (sobrevive a refresh) ---
const DRAFT_BATCH_MAP_KEY = 'v8:draft-batch-map';

export type DraftBatchMap = Record<string, string>; // { draftId: batchId }

export function loadDraftBatchMap(): DraftBatchMap {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(DRAFT_BATCH_MAP_KEY) : null;
    if (raw) return JSON.parse(raw) as DraftBatchMap;
  } catch { /* ignore */ }
  return {};
}

export function saveDraftBatchMap(map: DraftBatchMap) {
  try {
    window.localStorage.setItem(DRAFT_BATCH_MAP_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

export function addDraftBatchEntry(draftId: string, batchId: string) {
  const map = loadDraftBatchMap();
  map[draftId] = batchId;
  saveDraftBatchMap(map);
}

export function removeDraftBatchEntry(draftId: string) {
  const map = loadDraftBatchMap();
  delete map[draftId];
  saveDraftBatchMap(map);
}

export function removeDraftBatchByBatchId(batchId: string) {
  const map = loadDraftBatchMap();
  for (const key of Object.keys(map)) {
    if (map[key] === batchId) delete map[key];
  }
  saveDraftBatchMap(map);
}
