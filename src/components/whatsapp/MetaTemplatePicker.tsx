import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, Send, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MetaTemplate {
  id: string;
  waba_id: string;
  template_name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
}

interface MetaTemplatePickerProps {
  chipId: string;
  contactPhone: string;
  disabled?: boolean;
  onSent?: () => void;
}

/**
 * Extract variables per component type (HEADER and BODY separately).
 * Returns { header: ['{{1}}'], body: ['{{1}}','{{2}}'] }
 */
function extractVariablesByComponent(template: MetaTemplate): { header: string[]; body: string[] } {
  const result = { header: [] as string[], body: [] as string[] };
  if (!Array.isArray(template.components)) return result;
  for (const comp of template.components) {
    if (!comp.text) continue;
    const matches = comp.text.match(/\{\{(\d+)\}\}/g);
    if (!matches) continue;
    const unique = [...new Set(matches)].sort() as string[];
    if (comp.type === 'HEADER') result.header = unique;
    else if (comp.type === 'BODY') result.body = unique;
  }
  return result;
}

export default function MetaTemplatePicker({ chipId, contactPhone, disabled, onSent }: MetaTemplatePickerProps) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [headerVars, setHeaderVars] = useState<Record<string, string>>({});
  const [bodyVars, setBodyVars] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data: chip } = await supabase
      .from('chips')
      .select('meta_waba_id')
      .eq('id', chipId)
      .maybeSingle();

    if (!chip?.meta_waba_id) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('meta_message_templates')
      .select('*')
      .eq('waba_id', chip.meta_waba_id)
      .eq('status', 'APPROVED')
      .order('template_name');

    setTemplates((data as MetaTemplate[]) || []);
    setLoading(false);
  }, [chipId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filtered = templates.filter(t =>
    t.template_name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  const getPreviewText = (template: MetaTemplate): string => {
    if (!Array.isArray(template.components)) return '';
    const parts: string[] = [];
    for (const comp of template.components) {
      if (comp.type === 'HEADER' && comp.text) parts.push(`*${comp.text}*`);
      if (comp.type === 'BODY' && comp.text) parts.push(comp.text);
      if (comp.type === 'FOOTER' && comp.text) parts.push(`_${comp.text}_`);
    }
    return parts.join('\n\n');
  };

  const getFilledPreview = (template: MetaTemplate): string => {
    let text = getPreviewText(template);
    for (const [key, value] of Object.entries(headerVars)) {
      text = text.split(key).join(value || key);
    }
    for (const [key, value] of Object.entries(bodyVars)) {
      text = text.split(key).join(value || key);
    }
    return text;
  };

  const handleSelect = (template: MetaTemplate) => {
    setSelectedTemplate(template);
    const vars = extractVariablesByComponent(template);
    const hInit: Record<string, string> = {};
    vars.header.forEach(v => { hInit[v] = ''; });
    setHeaderVars(hInit);
    const bInit: Record<string, string> = {};
    vars.body.forEach(v => { bInit[v] = ''; });
    setBodyVars(bInit);
  };

  const handleSend = async () => {
    if (!selectedTemplate || !contactPhone) return;
    setSending(true);

    try {
      const phone = contactPhone.replace(/\D/g, '');

      // Build templateComponents array — only include sections that have variables
      const templateComponents: any[] = [];

      const headerKeys = Object.keys(headerVars);
      if (headerKeys.length > 0) {
        templateComponents.push({
          type: 'header',
          parameters: headerKeys
            .sort((a, b) => a.localeCompare(b))
            .map(k => ({ type: 'text', text: headerVars[k] || '—' })),
        });
      }

      const bodyKeys = Object.keys(bodyVars);
      if (bodyKeys.length > 0) {
        templateComponents.push({
          type: 'body',
          parameters: bodyKeys
            .sort((a, b) => a.localeCompare(b))
            .map(k => ({ type: 'text', text: bodyVars[k] || '—' })),
        });
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-gateway', {
        body: {
          action: 'send-template',
          chipId,
          phoneNumber: phone,
          templateName: selectedTemplate.template_name,
          templateLanguage: selectedTemplate.language,
          // Only send components if there are actual variables
          templateComponents: templateComponents.length > 0 ? templateComponents : undefined,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.success) {
        toast({ title: 'Template enviado com sucesso' });
        setSelectedTemplate(null);
        setHeaderVars({});
        setBodyVars({});
        onSent?.();
      } else {
        toast({ title: 'Erro ao enviar template', description: data?.error || 'Erro desconhecido', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao enviar template', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const allHeaderFilled = Object.keys(headerVars).length === 0 || Object.values(headerVars).every(v => v.trim().length > 0);
  const allBodyFilled = Object.keys(bodyVars).length === 0 || Object.values(bodyVars).every(v => v.trim().length > 0);
  const allVarsFilled = allHeaderFilled && allBodyFilled;

  // Selected template view with variable inputs
  if (selectedTemplate) {
    const hKeys = Object.keys(headerVars);
    const bKeys = Object.keys(bodyVars);

    return (
      <div className="flex flex-col gap-3 p-3 w-full max-w-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{selectedTemplate.template_name}</span>
            <Badge variant="outline" className="text-[10px]">{selectedTemplate.language}</Badge>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setSelectedTemplate(null); setHeaderVars({}); setBodyVars({}); }}>
            ← Voltar
          </Button>
        </div>

        {/* Preview */}
        <div className="bg-muted/30 rounded-lg p-3 text-sm whitespace-pre-wrap border border-border/30">
          {getFilledPreview(selectedTemplate)}
        </div>

        {/* Header variable inputs */}
        {hKeys.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Variáveis do cabeçalho:</p>
            {hKeys.map(key => (
              <div key={`h-${key}`} className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-16 shrink-0">Header {key}</Label>
                <Input
                  value={headerVars[key]}
                  onChange={e => setHeaderVars(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={`Valor para ${key}`}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {/* Body variable inputs */}
        {bKeys.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Variáveis do corpo:</p>
            {bKeys.map(key => (
              <div key={`b-${key}`} className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-16 shrink-0">Body {key}</Label>
                <Input
                  value={bodyVars[key]}
                  onChange={e => setBodyVars(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={`Valor para ${key}`}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={sending || disabled || !allVarsFilled}
          className="w-full"
          size="sm"
        >
          {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Enviar Template
        </Button>
      </div>
    );
  }

  // Template list
  return (
    <div className="flex flex-col gap-2 p-3 w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar template..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <ScrollArea className="h-[250px]">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {templates.length === 0
              ? 'Nenhum template aprovado. Importe em Admin → Integrações → Templates Meta.'
              : 'Nenhum template encontrado.'}
          </p>
        ) : (
          <div className="space-y-1">
            {filtered.map(t => {
              const bodyComp = Array.isArray(t.components)
                ? t.components.find((c: any) => c.type === 'BODY')
                : null;
              const preview = bodyComp?.text
                ? bodyComp.text.length > 60 ? bodyComp.text.slice(0, 60) + '…' : bodyComp.text
                : '—';

              return (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{t.template_name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{t.language}</Badge>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{t.category === 'MARKETING' ? 'Mkt' : t.category === 'UTILITY' ? 'Util' : t.category}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{preview}</p>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
