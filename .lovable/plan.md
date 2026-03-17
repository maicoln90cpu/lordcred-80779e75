

## Plano: Landing Page `/landing` — LordCred

### Novo arquivo
`src/pages/Landing.tsx` — Página completa com scroll, tema dark, usando componentes shadcn/ui existentes.

### Rota
`src/App.tsx` — Adicionar `<Route path="/landing" element={<Landing />} />` (pública, sem ProtectedRoute).

### Seções da Landing Page

1. **Hero** — Headline forte ("Aquecimento inteligente de chips WhatsApp + CRM de vendas integrado"), subtítulo persuasivo, CTA "Começar Agora" linkando para `/register`, badge "Em breve: Disparos em massa"
2. **Problemas/Dores** — 3 cards com ícones: chips bloqueados, gestão manual caótica, perda de leads
3. **Como Funciona** — 3 steps visuais: Conecte seus chips → Sistema aquece automaticamente → Venda com segurança
4. **Funcionalidades** — Grid de features com ícones: Aquecimento em 5 fases, Chat WhatsApp integrado, Kanban de conversas, Gestão de Leads, Monitor de chips, Dashboard de métricas, Chat interno, Proteção anti-bloqueio
5. **Em Breve: Disparos em Massa** — Seção highlight com badge "Coming Soon": disparo segmentado por perfil, agendamento, relatórios de entrega
6. **Diferenciais** — Por que LordCred: simulação humana real, variação aleatória, redução de fim de semana, múltiplos modos de aquecimento
7. **Planos/CTA Final** — Seção de conversão final com CTA "Fale Conosco" / "Começar Agora"
8. **Footer** — Logo + copyright

### Estilo
- Dark mode forçado na página (bg escuro, texto claro)
- Verde primary (`hsl(142 71% 45%)`) como cor de destaque
- Gradients sutis, cards com border
- Logo dourada do projeto no header
- Responsivo (mobile-first com grid adaptativo)
- Lucide icons para todos os ícones
- Animações CSS simples (fade-in com Tailwind)

### Arquivos modificados
1. **Novo:** `src/pages/Landing.tsx`
2. **Editado:** `src/App.tsx` (adicionar rota)

