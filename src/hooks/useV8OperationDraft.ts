import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook de auto-save para rascunhos de "Criar Proposta V8".
 * Etapa 5 — POST /operation.
 *
 * Estratégia:
 * - Debounce de 1.500ms para não sobrecarregar Postgres a cada tecla.
 * - INSERT no primeiro save, UPDATE nos seguintes (mantém o mesmo ID).
 * - RLS já garante isolamento por user_id.
 *
 * NÃO bloqueia a UI — falhas de save são apenas logadas.
 */
export type DraftOrigin = "simulation" | "lead" | "blank";

export interface DraftRow {
  id: string;
  user_id: string;
  origin_type: DraftOrigin;
  origin_id: string | null;
  cpf: string | null;
  borrower_name: string | null;
  form_data: Record<string, unknown>;
  last_step: string | null;
  is_submitted: boolean;
  submitted_operation_id: string | null;
  submitted_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface UseV8OperationDraftOptions {
  /** Origem do rascunho (simulation/lead/blank) */
  originType: DraftOrigin;
  /** ID externo da origem (simulation_id ou lead_id) — opcional para "blank" */
  originId?: string | null;
  /** Estado inicial do formulário (vem pré-preenchido pela origem) */
  initialFormData?: Record<string, unknown>;
  /** Quando dialog estiver fechado, evita criar/salvar rascunho. */
  enabled?: boolean;
}

export function useV8OperationDraft(opts: UseV8OperationDraftOptions) {
  const { originType, originId = null, initialFormData = {}, enabled = true } = opts;
  const [draftId, setDraftId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  /** Tenta carregar rascunho existente (não-enviado) para a mesma origem. */
  useEffect(() => {
    if (!enabled || !originId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("v8_operation_drafts" as any)
        .select("*")
        .eq("origin_type", originType)
        .eq("origin_id", originId)
        .eq("is_submitted", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) {
        const row = data as unknown as DraftRow;
        setDraftId(row.id);
        if (row.form_data && typeof row.form_data === "object") {
          setFormData(row.form_data);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, originType, originId]);

  const persist = useCallback(
    async (next: Record<string, unknown>) => {
      try {
        setIsSaving(true);
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (!uid) return;

        const borrower = (next?.borrower as Record<string, unknown>) || {};
        const payload = {
          user_id: uid,
          origin_type: originType,
          origin_id: originId,
          cpf: typeof borrower.cpf === "string" ? borrower.cpf.replace(/\D/g, "") : null,
          borrower_name: typeof borrower.name === "string" ? borrower.name : null,
          form_data: next,
        };

        if (draftId) {
          await supabase
            .from("v8_operation_drafts" as any)
            .update(payload)
            .eq("id", draftId);
        } else {
          const { data, error } = await supabase
            .from("v8_operation_drafts" as any)
            .insert(payload)
            .select("id")
            .maybeSingle();
          if (!error && data && mountedRef.current) {
            setDraftId((data as any).id);
          }
        }
        if (mountedRef.current) setLastSavedAt(new Date());
      } catch (err) {
        console.error("[useV8OperationDraft] save failed:", (err as Error).message);
      } finally {
        if (mountedRef.current) setIsSaving(false);
      }
    },
    [draftId, originType, originId],
  );

  const updateForm = useCallback(
    (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
      setFormData((prev) => {
        const next = updater(prev);
        if (!enabled) return next;
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        debounceRef.current = window.setTimeout(() => {
          void persist(next);
        }, 1500);
        return next;
      });
    },
    [enabled, persist],
  );

  const flush = useCallback(async () => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    await persist(formData);
  }, [formData, persist]);

  return {
    draftId,
    formData,
    setFormData,
    updateForm,
    isSaving,
    lastSavedAt,
    flush,
  };
}
