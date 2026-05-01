import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Plus, CalendarIcon, Upload, Image, FileText, Users, Filter, Eye, Sparkles } from 'lucide-react';

interface MetaTemplate {
  id: string;
  waba_id: string;
  template_name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
}

function extractTemplateVarsByComponent(template: MetaTemplate): { header: string[]; body: string[] } {
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

function getTemplatePreview(template: MetaTemplate): string {
  if (!Array.isArray(template.components)) return '';
  const parts: string[] = [];
  for (const comp of template.components) {
    if (comp.type === 'HEADER' && comp.text) parts.push(`*${comp.text}*`);
    if (comp.type === 'BODY' && comp.text) parts.push(comp.text);
    if (comp.type === 'FOOTER' && comp.text) parts.push(`_${comp.text}_`);
  }
  return parts.join('\n\n');
}

interface Profile {
  user_id: string;
  email: string;
  name: string | null;
}

interface Chip {
  id: string;
  instance_name: string;
  nickname: string | null;
  status: string;
  user_id: string;
  provider: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

// WhatsApp text formatting: *bold*, _italic_, ~strikethrough~, ```monospace```
function formatWhatsAppText(text: string): string {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    .replace(/```([^`]+)```/g, '<code style="background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:3px;font-family:monospace;font-size:12px">$1</code>');
  return html;
}

export default function BroadcastCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Overflow chips
  const [overflowChipIds, setOverflowChipIds] = useState<string[]>([]);

  // Basic fields
  const [formName, setFormName] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formMessageB, setFormMessageB] = useState('');
  const [abEnabled, setAbEnabled] = useState(false);
  const [formRate, setFormRate] = useState(10);

  // User + Chip selection
  const [users, setUsers] = useState<Profile[]>([]);
  const [allChips, setAllChips] = useState<Chip[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedChipId, setSelectedChipId] = useState('');

  // Media
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'document'>('none');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFilename, setMediaFilename] = useState('');
  const [uploading, setUploading] = useState(false);
  const [mediaInputMode, setMediaInputMode] = useState<'upload' | 'url'>('upload');

  // Scheduling
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState('09:00');

  // Source
  const [sourceType, setSourceType] = useState<'manual' | 'leads' | 'csv'>('manual');
  const [formPhones, setFormPhones] = useState('');

  // CSV
  const [csvPhones, setCsvPhones] = useState<string[]>([]);

  // Leads filters
  const [leadStatuses, setLeadStatuses] = useState<string[]>([]);
  const [leadBanks, setLeadBanks] = useState<string[]>([]);
  const [leadProfiles, setLeadProfiles] = useState<string[]>([]);
  const [leadSellers, setLeadSellers] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<string[]>([]);
  const [availableSellers, setAvailableSellers] = useState<{ id: string; name: string }[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [loadingLeads, setLoadingLeads] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadUsersAndChips();
  }, [open]);

  useEffect(() => {
    if (sourceType === 'leads' && open) {
      loadLeadFilterOptions();
    }
  }, [sourceType, open]);

  useEffect(() => {
    if (sourceType === 'leads') {
      countMatchingLeads();
    }
  }, [leadStatuses, leadBanks, leadProfiles, leadSellers, sourceType]);

  const loadUsersAndChips = async () => {
    const [usersRes, chipsRes] = await Promise.all([
      supabase.rpc('get_visible_profiles'),
      supabase.from('chips').select('id, instance_name, nickname, status, user_id, provider').eq('status', 'connected'),
    ]);
    if (chipsRes.data) setAllChips(chipsRes.data);
    // Only show users that have at least one connected chip
    if (usersRes.data && chipsRes.data) {
      const usersWithChip = new Set(chipsRes.data.map(c => c.user_id));
      setUsers(usersRes.data.filter(u => usersWithChip.has(u.user_id)));
    } else if (usersRes.data) {
      setUsers(usersRes.data);
    }
  };

  const loadLeadFilterOptions = async () => {
    const { data } = await supabase.from('client_leads').select('status, banco_nome, perfil, assigned_to');
    if (!data) return;

    const statuses = [...new Set(data.map(d => d.status).filter(Boolean))] as string[];
    const banks = [...new Set(data.map(d => d.banco_nome).filter(Boolean))] as string[];
    const profiles = [...new Set(data.map(d => d.perfil).filter(Boolean))] as string[];
    const sellerIds = [...new Set(data.map(d => d.assigned_to).filter(Boolean))];

    setAvailableStatuses(statuses);
    setAvailableBanks(banks);
    setAvailableProfiles(profiles);

    // Fetch seller names
    if (sellerIds.length > 0) {
      const { data: allProfiles } = await supabase.rpc('get_visible_profiles');
      const sellerProfiles = (allProfiles || []).filter((p: any) => sellerIds.includes(p.user_id));
      if (sellerProfiles) {
        setAvailableSellers(sellerProfiles.map(s => ({ id: s.user_id, name: s.name || s.email })));
      }
    }
  };

  const countMatchingLeads = async () => {
    setLoadingLeads(true);
    let query = supabase.from('client_leads').select('telefone', { count: 'exact', head: true })
      .not('telefone', 'is', null)
      .neq('telefone', '');

    if (leadStatuses.length > 0) query = query.in('status', leadStatuses);
    if (leadBanks.length > 0) query = query.in('banco_nome', leadBanks);
    if (leadProfiles.length > 0) query = query.in('perfil', leadProfiles);
    if (leadSellers.length > 0) query = query.in('assigned_to', leadSellers);

    const { count } = await query;
    setLeadCount(count || 0);
    setLoadingLeads(false);
  };

  const filteredChips = allChips.filter(c => !selectedUserId || c.user_id === selectedUserId);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/[\n\r]+/).filter(Boolean);
      // Try to detect phone column
      const phones: string[] = [];
      for (const line of lines) {
        const cols = line.split(/[,;\t]+/);
        for (const col of cols) {
          const cleaned = col.trim().replace(/\D/g, '');
          if (cleaned.length >= 10 && cleaned.length <= 13) {
            phones.push(cleaned);
            break; // Take first phone-like column per row
          }
        }
      }
      setCsvPhones([...new Set(phones)]);
      toast({ title: `${phones.length} telefones detectados no CSV` });
    };
    reader.readAsText(file);
  };

  const getPhoneCount = () => {
    if (sourceType === 'manual') {
      return formPhones.split(/[\n,;]+/).filter(p => p.trim().replace(/\D/g, '').length >= 10).length;
    }
    if (sourceType === 'csv') return csvPhones.length;
    if (sourceType === 'leads') return leadCount;
    return 0;
  };

  const handleCreate = async () => {
    if (!formName || !formMessage || !selectedChipId) {
      toast({ title: 'Preencha nome, chip e mensagem', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      let phones: string[] = [];
      const leadIdMap: Record<string, string> = {};

      if (sourceType === 'manual') {
        phones = formPhones.split(/[\n,;]+/).map(p => p.trim().replace(/\D/g, '')).filter(p => p.length >= 10);
      } else if (sourceType === 'csv') {
        phones = csvPhones;
      } else if (sourceType === 'leads') {
        // Fetch lead phones matching filters + lead ids for variable substitution
        let query = supabase.from('client_leads').select('id, telefone')
          .not('telefone', 'is', null)
          .neq('telefone', '');
        if (leadStatuses.length > 0) query = query.in('status', leadStatuses);
        if (leadBanks.length > 0) query = query.in('banco_nome', leadBanks);
        if (leadProfiles.length > 0) query = query.in('perfil', leadProfiles);
        if (leadSellers.length > 0) query = query.in('assigned_to', leadSellers);

        const { data: leads } = await query;
        if (leads) {
          // Build phone-to-lead map for lead_id linking
          const seen = new Set<string>();
          for (const l of leads) {
            const cleaned = (l.telefone || '').replace(/\D/g, '');
            if (cleaned.length >= 10 && !seen.has(cleaned)) {
              seen.add(cleaned);
              phones.push(cleaned);
              leadIdMap[cleaned] = l.id;
            }
          }
        }
      }

      phones = [...new Set(phones)]; // Deduplicate

      if (phones.length === 0) {
        toast({ title: 'Nenhum telefone válido encontrado', variant: 'destructive' });
        setCreating(false);
        return;
      }

      // Build scheduled_date
      let scheduledDate: string | null = null;
      if (enableSchedule && scheduleDate) {
        const [h, m] = scheduleTime.split(':').map(Number);
        const dt = new Date(scheduleDate);
        dt.setHours(h, m, 0, 0);
        scheduledDate = dt.toISOString();
      }

      const { data: campaign, error } = await supabase
        .from('broadcast_campaigns')
        .insert({
          name: formName,
          message_content: formMessage,
          message_variant_b: abEnabled ? formMessageB : null,
          ab_enabled: abEnabled,
          chip_id: selectedChipId,
          rate_per_minute: formRate,
          total_recipients: phones.length,
          created_by: user!.id,
          status: enableSchedule ? 'scheduled' : 'draft',
          media_type: mediaType === 'none' ? null : mediaType,
          media_url: mediaType !== 'none' ? mediaUrl : null,
          media_filename: mediaType === 'document' ? mediaFilename : null,
          scheduled_date: scheduledDate,
          source_type: sourceType,
          source_filters: sourceType === 'leads' ? {
            statuses: leadStatuses,
            banks: leadBanks,
            profiles: leadProfiles,
            sellers: leadSellers,
          } : null,
          owner_user_id: selectedUserId || null,
          overflow_chip_ids: overflowChipIds.length > 0 ? overflowChipIds : [],
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Insert recipients in batches
      const batchSize = 500;
      for (let i = 0; i < phones.length; i += batchSize) {
        const batch = phones.slice(i, i + batchSize).map(phone => ({
          campaign_id: campaign.id,
          phone,
          ...(leadIdMap[phone] ? { lead_id: leadIdMap[phone] } : {}),
        }));
        await supabase.from('broadcast_recipients').insert(batch as any);
      }

      toast({ title: `Campanha criada com ${phones.length} destinatários` });
      onOpenChange(false);
      resetForm();
      onCreated();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setCreating(false);
  };

  const resetForm = () => {
    setFormName(''); setFormMessage(''); setFormMessageB(''); setAbEnabled(false); setFormRate(10);
    setSelectedUserId(''); setSelectedChipId('');
    setMediaType('none'); setMediaUrl(''); setMediaFilename(''); setUploading(false); setMediaInputMode('upload');
    setEnableSchedule(false); setScheduleDate(undefined); setScheduleTime('09:00');
    setSourceType('manual'); setFormPhones('');
    setCsvPhones([]);
    setLeadStatuses([]); setLeadBanks([]); setLeadProfiles([]); setLeadSellers([]); setShowPreview(false); setOverflowChipIds([]);
  };

  const MultiSelect = ({ label, options, selected, onChange }: {
    label: string; options: { value: string; label: string }[];
    selected: string[]; onChange: (v: string[]) => void;
  }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <ScrollArea className="h-24 border rounded-md p-2 mt-1">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum disponível</p>
        ) : options.map(o => (
          <label key={o.value} className="flex items-center gap-2 py-0.5 text-xs cursor-pointer hover:bg-muted/50 px-1 rounded">
            <Checkbox
              checked={selected.includes(o.value)}
              onCheckedChange={checked => {
                onChange(checked ? [...selected, o.value] : selected.filter(v => v !== o.value));
              }}
            />
            {o.label}
          </label>
        ))}
      </ScrollArea>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Campanha</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Nome */}
          <div>
            <Label>Nome da Campanha</Label>
            <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Promoção FGTS Abril" />
          </div>

          {/* Usuário + Chip */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Usuário (dono do chip)</Label>
              <Select value={selectedUserId} onValueChange={v => { setSelectedUserId(v); setSelectedChipId(''); }}>
                <SelectTrigger><SelectValue placeholder="Todos os usuários" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chip de Envio</Label>
              <Select value={selectedChipId} onValueChange={setSelectedChipId}>
                <SelectTrigger><SelectValue placeholder="Selecione o chip..." /></SelectTrigger>
                <SelectContent>
                  {filteredChips.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nickname || c.instance_name} {c.provider === 'meta' ? '[META]' : '[UazAPI]'}
                    </SelectItem>
                  ))}
                  {filteredChips.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground text-center">Nenhum chip conectado</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Overflow Chips */}
          {selectedChipId && (
            <div className="border rounded-lg p-3 space-y-2">
              <Label className="text-xs flex items-center gap-2">🔄 Chips de Overflow (quando limite diário atingido)</Label>
              <p className="text-[11px] text-muted-foreground">
                Cada chip tem limite de 200 msgs/dia. Selecione chips extras para continuar o envio automaticamente.
              </p>
              <ScrollArea className="max-h-24">
                {allChips
                  .filter(c => c.id !== selectedChipId && c.status === 'connected')
                  .map(c => (
                    <label key={c.id} className="flex items-center gap-2 py-0.5 text-xs cursor-pointer hover:bg-muted/50 px-1 rounded">
                      <Checkbox
                        checked={overflowChipIds.includes(c.id)}
                        onCheckedChange={checked => {
                          setOverflowChipIds(prev => checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                        }}
                      />
                      {c.nickname || c.instance_name} {c.provider === 'meta' ? '[META]' : '[UazAPI]'}
                    </label>
                  ))}
                {allChips.filter(c => c.id !== selectedChipId && c.status === 'connected').length === 0 && (
                  <p className="text-[11px] text-muted-foreground">Nenhum chip extra disponível</p>
                )}
              </ScrollArea>
              {overflowChipIds.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  💡 {getPhoneCount()} msgs → até {Math.min(200, getPhoneCount())} no chip principal, resto nos {overflowChipIds.length} chip(s) extra(s)
                </Badge>
              )}
            </div>
          )}


          <div>
            <Label>{abEnabled ? 'Mensagem (Variante A)' : 'Mensagem'}</Label>
            <Textarea value={formMessage} onChange={e => setFormMessage(e.target.value)} placeholder="Texto da mensagem..." rows={3} />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">{formMessage.length} caracteres</p>
              {sourceType === 'leads' && (
                <div className="flex flex-wrap gap-1">
                  {['{{nome}}', '{{cpf}}', '{{banco}}', '{{telefone}}', '{{perfil}}', '{{status}}'].map(v => (
                    <button
                      key={v}
                      type="button"
                      className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors"
                      onClick={() => setFormMessage(prev => prev + ' ' + v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setShowPreview(p => !p)}
            >
              <Eye className="w-3 h-3 mr-1" />
              {showPreview ? 'Ocultar preview' : 'Preview'}
            </Button>
          </div>

          {/* WhatsApp Preview */}
          {showPreview && (
            <div className="bg-[#efeae2] dark:bg-[#0b141a] rounded-lg p-4 flex justify-end">
              <div className="bg-[#d9fdd3] dark:bg-[#005c4b] rounded-lg p-2.5 max-w-[280px] shadow-sm relative">
                {mediaType === 'image' && mediaUrl && (
                  <div className="mb-1.5 rounded overflow-hidden bg-muted/30">
                    <img src={mediaUrl} alt="preview" className="w-full max-h-40 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                )}
                {mediaType === 'image' && !mediaUrl && (
                  <div className="mb-1.5 rounded bg-muted/30 h-24 flex items-center justify-center">
                    <Image className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                )}
                {mediaType === 'document' && (
                  <div className="mb-1.5 rounded bg-muted/20 dark:bg-white/10 p-2 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-red-400" />
                    <span className="text-xs truncate">{mediaFilename || 'documento.pdf'}</span>
                  </div>
                )}
                <p className="text-[13px] text-[#111b21] dark:text-[#e9edef] whitespace-pre-wrap leading-snug"
                  dangerouslySetInnerHTML={{
                    __html: formatWhatsAppText(
                      (formMessage || 'Sua mensagem aqui...').replace(/\{\{(\w+)\}\}/g, (_, key) => {
                        const samples: Record<string, string> = { nome: 'João Silva', cpf: '123.456.789-00', banco: 'Itaú', telefone: '(11) 99999-8888', perfil: 'CLT', status: 'Novo' };
                        return samples[key.toLowerCase()] || `{{${key}}}`;
                      })
                    )
                  }}
                />
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-[10px] text-[#53bdeb]">✓✓</span>
                </div>
              </div>
            </div>
          )}
          </div>


          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Switch checked={abEnabled} onCheckedChange={setAbEnabled} />
              <Label className="cursor-pointer">Teste A/B</Label>
              {abEnabled && <Badge variant="outline" className="text-[10px]">50% A / 50% B</Badge>}
            </div>
            {abEnabled && (
              <div>
                <Label className="text-xs">Mensagem (Variante B)</Label>
                <Textarea value={formMessageB} onChange={e => setFormMessageB(e.target.value)} placeholder="Versão alternativa da mensagem..." rows={3} />
                <p className="text-xs text-muted-foreground mt-1">{formMessageB.length} caracteres</p>
              </div>
            )}
          </div>

          {/* Mídia */}
          <div className="border rounded-lg p-3 space-y-2">
            <Label className="flex items-center gap-2"><Image className="w-4 h-4" /> Mídia (opcional)</Label>
            <RadioGroup value={mediaType} onValueChange={v => setMediaType(v as any)} className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="none" id="media-none" />
                <Label htmlFor="media-none" className="text-xs cursor-pointer">Nenhuma</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="image" id="media-image" />
                <Label htmlFor="media-image" className="text-xs cursor-pointer flex items-center gap-1"><Image className="w-3 h-3" /> Imagem</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="document" id="media-doc" />
                <Label htmlFor="media-doc" className="text-xs cursor-pointer flex items-center gap-1"><FileText className="w-3 h-3" /> Documento</Label>
              </div>
            </RadioGroup>
            {mediaType !== 'none' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button" size="sm"
                    variant={mediaInputMode === 'upload' ? 'default' : 'outline'}
                    onClick={() => setMediaInputMode('upload')}
                  >
                    <Upload className="w-3 h-3 mr-1" /> Upload
                  </Button>
                  <Button
                    type="button" size="sm"
                    variant={mediaInputMode === 'url' ? 'default' : 'outline'}
                    onClick={() => setMediaInputMode('url')}
                  >
                    🔗 Colar URL
                  </Button>
                </div>
                {mediaInputMode === 'upload' ? (
                  <div>
                    <Input
                      type="file"
                      accept={mediaType === 'image' ? 'image/*' : '*'}
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        try {
                          const ext = file.name.split('.').pop() || 'bin';
                          const path = `${crypto.randomUUID()}.${ext}`;
                          const { error } = await supabase.storage.from('broadcast-media').upload(path, file);
                          if (error) throw error;
                          const { data: urlData } = supabase.storage.from('broadcast-media').getPublicUrl(path);
                          setMediaUrl(urlData.publicUrl);
                          setMediaFilename(file.name);
                          toast({ title: `${file.name} enviado com sucesso` });
                        } catch (err: any) {
                          toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
                        }
                        setUploading(false);
                      }}
                    />
                    {uploading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Enviando...</div>}
                    {mediaUrl && !uploading && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        ✅ {mediaFilename || 'Arquivo enviado'}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="URL da mídia (https://...)" />
                )}
                {mediaType === 'document' && mediaInputMode === 'url' && (
                  <Input value={mediaFilename} onChange={e => setMediaFilename(e.target.value)} placeholder="Nome do arquivo (ex: proposta.pdf)" />
                )}
              </div>
            )}
          </div>

          {/* Agendamento */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Switch checked={enableSchedule} onCheckedChange={setEnableSchedule} />
              <Label className="flex items-center gap-2 cursor-pointer"><CalendarIcon className="w-4 h-4" /> Agendar envio</Label>
            </div>
            {enableSchedule && (
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !scheduleDate && 'text-muted-foreground')}>
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {scheduleDate ? format(scheduleDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-28">
                  <Label className="text-xs">Hora</Label>
                  <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Taxa */}
          <div>
            <Label>Taxa de Envio: {formRate} msgs/minuto</Label>
            <Slider value={[formRate]} onValueChange={v => setFormRate(v[0])} min={1} max={20} step={1} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">Menor taxa = menor risco de bloqueio</p>
          </div>

          {/* Destinatários */}
          <div className="border rounded-lg p-3 space-y-3">
            <Label className="flex items-center gap-2"><Users className="w-4 h-4" /> Destinatários</Label>
            <RadioGroup value={sourceType} onValueChange={v => setSourceType(v as any)} className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="manual" id="src-manual" />
                <Label htmlFor="src-manual" className="text-xs cursor-pointer">Manual</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="leads" id="src-leads" />
                <Label htmlFor="src-leads" className="text-xs cursor-pointer flex items-center gap-1"><Filter className="w-3 h-3" /> Leads</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="csv" id="src-csv" />
                <Label htmlFor="src-csv" className="text-xs cursor-pointer flex items-center gap-1"><Upload className="w-3 h-3" /> CSV</Label>
              </div>
            </RadioGroup>

            {sourceType === 'manual' && (
              <div>
                <Textarea value={formPhones} onChange={e => setFormPhones(e.target.value)} placeholder="(11) 99999-8888&#10;(21) 98888-7777&#10;..." rows={4} />
                <p className="text-xs text-muted-foreground mt-1">{getPhoneCount()} telefones válidos</p>
              </div>
            )}

            {sourceType === 'csv' && (
              <div className="space-y-2">
                <Input type="file" accept=".csv,.txt,.tsv" onChange={handleCsvUpload} />
                {csvPhones.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{csvPhones.length} telefones importados</Badge>
                )}
              </div>
            )}

            {sourceType === 'leads' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <MultiSelect
                    label="Status"
                    options={availableStatuses.map(s => ({ value: s, label: s }))}
                    selected={leadStatuses}
                    onChange={setLeadStatuses}
                  />
                  <MultiSelect
                    label="Banco"
                    options={availableBanks.map(b => ({ value: b, label: b }))}
                    selected={leadBanks}
                    onChange={setLeadBanks}
                  />
                  <MultiSelect
                    label="Perfil"
                    options={availableProfiles.map(p => ({ value: p, label: p }))}
                    selected={leadProfiles}
                    onChange={setLeadProfiles}
                  />
                  <MultiSelect
                    label="Vendedor"
                    options={availableSellers.map(s => ({ value: s.id, label: s.name }))}
                    selected={leadSellers}
                    onChange={setLeadSellers}
                  />
                </div>
                <div className="flex items-center gap-2 bg-muted/50 rounded p-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    {loadingLeads ? <Loader2 className="w-3 h-3 animate-spin inline" /> : leadCount} leads com telefone
                  </span>
                  {(leadStatuses.length + leadBanks.length + leadProfiles.length + leadSellers.length) === 0 && (
                    <span className="text-xs text-muted-foreground">(sem filtros = todos)</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <div className="flex items-center gap-2 mr-auto">
            <Badge variant="outline" className="text-xs">{getPhoneCount()} destinatários</Badge>
            {enableSchedule && scheduleDate && (
              <Badge variant="outline" className="text-xs">
                <CalendarIcon className="w-3 h-3 mr-1" />
                {format(scheduleDate, 'dd/MM', { locale: ptBR })} {scheduleTime}
              </Badge>
            )}
            {mediaType !== 'none' && (
              <Badge variant="outline" className="text-xs">
                {mediaType === 'image' ? <Image className="w-3 h-3 mr-1" /> : <FileText className="w-3 h-3 mr-1" />}
                {mediaType === 'image' ? 'Imagem' : 'Documento'}
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Criar Campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
