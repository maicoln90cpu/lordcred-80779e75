// Auto-generates docs/PARITY-REPORT.md from Deno contract tests
// Usage: deno run --allow-read --allow-write scripts/generate-parity-report.ts

const TEST_FILE = "supabase/functions/whatsapp-gateway/meta_contract_test.ts";
const OUT_FILE = "docs/PARITY-REPORT.md";
const CHANGELOG = "docs/CHANGELOG.md";
const SETUP_DOC = "docs/META-WHATSAPP-SETUP.md";

const src = await Deno.readTextFile(TEST_FILE);

// Extract Deno.test("...") names
const testRegex = /Deno\.test\(\s*["'`](.+?)["'`]/g;
const tests: string[] = [];
let m;
while ((m = testRegex.exec(src)) !== null) tests.push(m[1]);

// Static parity matrix (UazAPI vs Meta) — kept here as single source of truth
const matrix: Array<{ feature: string; uazapi: string; meta: string; notes: string }> = [
  { feature: "Envio de texto",            uazapi: "✅", meta: "✅", notes: "Paridade total" },
  { feature: "Envio de mídia (img/vid/doc/audio)", uazapi: "✅", meta: "✅", notes: "Meta requer upload prévio (media_id)" },
  { feature: "Sticker (webp ≤500KB)",      uazapi: "✅", meta: "✅", notes: "Meta valida tamanho/formato" },
  { feature: "Resposta citada (quoted)",   uazapi: "✅", meta: "✅", notes: "Meta usa context.message_id" },
  { feature: "Encaminhar mensagem",        uazapi: "✅", meta: "✅", notes: "Cache de media_id (25d) + reupload cross-chip" },
  { feature: "Apagar mensagem",            uazapi: "✅", meta: "❌", notes: "Meta não suporta — retorna unsupported:true" },
  { feature: "Editar mensagem",            uazapi: "✅", meta: "❌", notes: "Meta não suporta — retorna unsupported:true" },
  { feature: "Indicador de digitação",     uazapi: "✅", meta: "❌", notes: "Meta não suporta — retorna unsupported:true" },
  { feature: "Marcar como lida",           uazapi: "✅", meta: "✅", notes: "Meta usa /messages com status=read" },
  { feature: "Templates aprovados",        uazapi: "N/A", meta: "✅", notes: "Exclusivo Meta (HSM)" },
  { feature: "Webhook de status",          uazapi: "✅", meta: "✅", notes: "Hierarquia: read > delivered > sent" },
];

const now = new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";

let md = `# Relatório de Paridade — UazAPI vs Meta WhatsApp Cloud API

> 🤖 **Gerado automaticamente** em ${now}
> Fonte de testes: \`${TEST_FILE}\`
> Não edite manualmente — rode \`deno run --allow-read --allow-write scripts/generate-parity-report.ts\`

## 📊 Matriz de Paridade

| Funcionalidade | UazAPI | Meta | Observações |
|---|:---:|:---:|---|
${matrix.map(r => `| ${r.feature} | ${r.uazapi} | ${r.meta} | ${r.notes} |`).join("\n")}

## 🧪 Testes de Contrato (Deno)

Total: **${tests.length} testes** garantindo o contrato de resposta entre frontend e \`whatsapp-gateway\`.

${tests.map((t, i) => `${i + 1}. \`${t}\``).join("\n")}

### Como rodar
\`\`\`bash
deno test supabase/functions/whatsapp-gateway/meta_contract_test.ts
\`\`\`

## 🔁 Estratégia de Fallback (Meta)

Quando uma ação não é suportada, o gateway retorna:
\`\`\`json
{ "success": false, "unsupported": true, "provider": "meta", "error": "..." }
\`\`\`
O frontend exibe toast amigável: **"Função indisponível na Meta"**.

## 📦 Cache de Media (forward-message)

Tabela \`meta_media_cache\` (TTL 25 dias, antes da expiração de 30d da Meta):
- **Layer 1**: Cache hit → reusa \`media_id\`
- **Layer 2**: Mesmo chip → reusa \`media_url\` direto
- **Layer 3**: Cross-chip → download + reupload Meta + atualiza cache
- **Layer 4**: Fallback amigável \`{ fallback: true, reason: "media_unavailable" }\`

## 📚 Links Relacionados

- [CHANGELOG](./${CHANGELOG.split("/").pop()})
- [Setup Meta WhatsApp](./${SETUP_DOC.split("/").pop()})
- [Edge Functions](./EDGE-FUNCTIONS.md)

---
_Última atualização automática: ${now}_
`;

await Deno.writeTextFile(OUT_FILE, md);
console.log(`✅ ${OUT_FILE} gerado com ${tests.length} testes e ${matrix.length} linhas de paridade.`);
