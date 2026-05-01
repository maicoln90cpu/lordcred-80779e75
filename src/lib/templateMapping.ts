/**
 * Frontend mirror of supabase/functions/_shared/templateMapping.ts
 * Kept as a tiny duplicate (no shared module between Vite and Deno) — covered by Deno tests.
 */

export function suggestAutoMapping(bodyText: string | undefined, varCount: number): string | null {
  if (varCount !== 1 || !bodyText) return null;
  const t = bodyText.toLowerCase();
  const greetingPatterns = [
    /\bol[áa]\b/, /\boi\b/, /\bprezad[oa]s?\b/, /\bcar[oa]s?\b/,
    /\bbom dia\b/, /\bboa tarde\b/, /\bboa noite\b/, /\btudo bem\b/,
  ];
  return greetingPatterns.some(re => re.test(t)) ? 'nome' : null;
}
