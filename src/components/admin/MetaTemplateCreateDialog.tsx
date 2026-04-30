import { useState } from 'react';
import { Loader2, Plus, Trash2, HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  metaChips: any[];
  onCreated: () => void;
}

interface ButtonItem {
  type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
  text: string;
  url?: string;
  phone_number?: string;
}

export default function MetaTemplateCreateDialog({ metaChips, onCreated }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('UTILITY');
  const [language, setLanguage] = useState('pt_BR');
  const [headerText, setHeaderText] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState<ButtonItem[]>([]);
  const [selectedChipId, setSelectedChipId] = useState('');

  const resetForm = () => {
    setName('');
    setCategory('UTILITY');
    setLanguage('pt_BR');
    setHeaderText('');
    setBodyText('');
    setFooterText('');
    setButtons([]);
    setSelectedChipId('');
  };

  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }]);
  };

  const updateButton = (idx: number, field: string, value: string) => {
    setButtons(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };

  const removeButton = (idx: number) => {
    setButtons(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!trimmedName) {
      toast({ title: 'Nome do template é obrigatório', variant: 'destructive' });
      return;
    }
    if (!bodyText.trim()) {
      toast({ title: 'Corpo da mensagem é obrigatório', variant: 'destructive' });
      return;
    }

    const chipId = selectedChipId || metaChips[0]?.id;
    if (!chipId) {
      toast({ title: 'Nenhum chip Meta disponível', variant: 'destructive' });
      return;
    }

    // Build components array per Meta API spec
    const components: any[] = [];

    if (headerText.trim()) {
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText.trim() });
    }

    components.push({ type: 'BODY', text: bodyText.trim() });

    if (footerText.trim()) {
      components.push({ type: 'FOOTER', text: footerText.trim() });
    }

    const validButtons = buttons.filter(b => b.text.trim());
    if (validButtons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: validButtons.map(b => {
          if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url || '' };
          if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number || '' };
          return { type: 'QUICK_REPLY', text: b.text };
        }),
      });
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-gateway', {
        body: {
          action: 'create-template',
          chipId,
          name: trimmedName,
          language,
          category,
          components,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Falha ao criar template');

      toast({ title: 'Template enviado para aprovação da Meta' });
      resetForm();
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast({ title: 'Erro ao criar template', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          Criar Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Template Meta</DialogTitle>
          <DialogDescription>
            O template será enviado para aprovação da Meta. Apenas templates aprovados podem ser usados para iniciar conversas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {metaChips.length > 1 && (
            <div className="space-y-1.5">
              <Label>Chip (WABA)</Label>
              <Select value={selectedChipId || metaChips[0]?.id} onValueChange={setSelectedChipId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metaChips.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.phone_number || c.instance_name || c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="meu_template"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={512}
              />
              <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e _</p>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utilidade</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Idioma</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt_BR">Português (BR)</SelectItem>
                <SelectItem value="en_US">English (US)</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cabeçalho (opcional)</Label>
            <Input
              placeholder="Título do template"
              value={headerText}
              onChange={e => setHeaderText(e.target.value)}
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">Máx. 60 caracteres</p>
          </div>

          <div className="space-y-1.5">
            <Label>Corpo da mensagem *</Label>
            <Textarea
              placeholder="Olá {{1}}, sua solicitação {{2}} foi processada."
              value={bodyText}
              onChange={e => setBodyText(e.target.value)}
              rows={4}
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground">
              Use {'{{1}}'}, {'{{2}}'} etc. para variáveis. Máx. 1024 caracteres.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Rodapé (opcional)</Label>
            <Input
              placeholder="Enviado por LordCred"
              value={footerText}
              onChange={e => setFooterText(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Botões (opcional, máx. 3)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addButton}
                disabled={buttons.length >= 3}
              >
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            {buttons.map((btn, idx) => (
              <div key={idx} className="flex gap-2 items-start border rounded-md p-2">
                <div className="flex-1 space-y-2">
                  <Select value={btn.type} onValueChange={v => updateButton(idx, 'type', v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUICK_REPLY">Resposta rápida</SelectItem>
                      <SelectItem value="URL">Link (URL)</SelectItem>
                      <SelectItem value="PHONE_NUMBER">Telefone</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Texto do botão"
                    value={btn.text}
                    onChange={e => updateButton(idx, 'text', e.target.value)}
                    maxLength={25}
                    className="h-8 text-xs"
                  />
                  {btn.type === 'URL' && (
                    <Input
                      placeholder="https://exemplo.com"
                      value={btn.url || ''}
                      onChange={e => updateButton(idx, 'url', e.target.value)}
                      className="h-8 text-xs"
                    />
                  )}
                  {btn.type === 'PHONE_NUMBER' && (
                    <Input
                      placeholder="+5511999999999"
                      value={btn.phone_number || ''}
                      onChange={e => updateButton(idx, 'phone_number', e.target.value)}
                      className="h-8 text-xs"
                    />
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeButton(idx)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar para Aprovação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
