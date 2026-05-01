// Shared logic for Meta template variable substitution.
// Pure functions — fully unit-testable via Deno test runner.

export type LeadFields = Record<string, string | null | undefined>;

export type TemplateParameter =
  | { type: 'text'; text: string }
  | { type: 'lead_field'; field: string }
  | { type: string; [k: string]: any };

export interface TemplateComponent {
  type: string;                  // 'header' | 'body' | ...
  parameters?: TemplateParameter[];
  [k: string]: any;
}

/** Replace {{key}} or {{1}} placeholders in free text. */
export function replaceVariables(
  text: string,
  vars: Record<string, string | null | undefined>,
): string {
  if (!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const v = vars[String(key).toLowerCase()];
    return v == null || v === '' ? match : String(v);
  });
}

/**
 * Resolve a single parameter against a lead.
 * - {type:'text'}          → keep as-is, but apply {{var}} substitution on the text
 * - {type:'lead_field'}    → replace by lead[field] (fallback '—' if null)
 * - other types            → unchanged
 */
export function resolveParameter(
  param: TemplateParameter,
  lead: LeadFields | null,
): TemplateParameter {
  if (!param || typeof param !== 'object') return param;

  if (param.type === 'lead_field') {
    const field = String((param as any).field || '').toLowerCase();
    const value = lead?.[field];
    return { type: 'text', text: value != null && value !== '' ? String(value) : '—' };
  }

  if (param.type === 'text' && typeof (param as any).text === 'string' && lead) {
    const vars: Record<string, string | null | undefined> = {};
    for (const k of Object.keys(lead)) vars[k.toLowerCase()] = lead[k];
    return { type: 'text', text: replaceVariables((param as any).text, vars) };
  }

  return param;
}

/** Apply lead-driven substitution to every component/parameter. Returns a deep copy. */
export function applyComponentMapping(
  components: TemplateComponent[] | null | undefined,
  lead: LeadFields | null,
): TemplateComponent[] {
  if (!Array.isArray(components)) return [];
  return components.map(comp => {
    const next: TemplateComponent = { ...comp };
    if (Array.isArray(comp.parameters)) {
      next.parameters = comp.parameters.map(p => resolveParameter(p, lead));
    }
    return next;
  });
}

/**
 * Heuristic: when a template has exactly ONE body variable AND its surrounding
 * text suggests a greeting, suggest mapping it to lead.nome.
 * Returns the suggested field name or null.
 */
export function suggestAutoMapping(bodyText: string | undefined, varCount: number): string | null {
  if (varCount !== 1 || !bodyText) return null;
  const t = bodyText.toLowerCase();
  // Use word-boundary regex to avoid false positives like "foi " matching "oi "
  const greetingPatterns = [
    /\bol[áa]\b/, /\boi\b/, /\bprezad[oa]s?\b/, /\bcar[oa]s?\b/,
    /\bbom dia\b/, /\bboa tarde\b/, /\bboa noite\b/, /\btudo bem\b/,
  ];
  if (greetingPatterns.some(re => re.test(t))) return 'nome';
  return null;
}
