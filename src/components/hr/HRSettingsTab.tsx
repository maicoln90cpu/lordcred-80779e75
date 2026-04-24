import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bell, MessageSquare, ListChecks, Loader2, Save, Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface HRSettings {
  id: string;
  offset_1_minutes: number;
  offset_2_minutes: number;
  template_1_text: string;
  template_2_text: string;
}

interface HRQuestion {
  id: string;
  stage: number;
  order_num: number;
  text: string;
}

const PLACEHOLDERS = [
  { key: '{name}', desc: 'Nome do candidato' },
  { key: '{date}', desc: 'Data formatada (dd/MM/yyyy)' },
  { key: '{time}', desc: 'Hora formatada (HH:mm)' },
];

function applyPreview(text: string) {
  return text
    .replace(/{name}/g, 'João Silva')
    .replace(/{date}/g, '25/04/2026')
    .replace(/{time}/g, '14:30');
}

function minutesToReadable(min: number): string {
  if (min < 60) return `${min} minuto${min !== 1 ? 's' : ''}`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${m}m`;
  }
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return h === 0 ? `${d} dia${d !== 1 ? 's' : ''}` : `${d}d ${h}h`;
}

export function HRSettingsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<HRSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<HRQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState<{ stage: 1 | 2; text: string }>({ stage: 1, text: '' });

  const fetchAll = async () => {
    try {
      const [{ data: s, error: sErr }, { data: q, error: qErr }] = await Promise.all([
        (supabase as any).from('hr_notification_settings').select('*').limit(1).maybeSingle(),
        (supabase as any).from('hr_questions').select('*').order('stage').order('order_num'),
      ]);
      if (sErr) throw sErr;
      if (qErr) throw qErr;
      setSettings(s);
      setQuestions((q || []) as HRQuestion[]);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar configurações', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useRealtimeSubscription(() => fetchAll(), { table: 'hr_questions', event: '*', debounceMs: 500 });

  const stage1 = useMemo(() => questions.filter(q => q.stage === 1), [questions]);
  const stage2 = useMemo(() => questions.filter(q => q.stage === 2), [questions]);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('hr_notification_settings')
        .update({
          offset_1_minutes: settings.offset_1_minutes,
          offset_2_minutes: settings.offset_2_minutes,
          template_1_text: settings.template_1_text,
          template_2_text: settings.template_2_text,
        })
        .eq('id', settings.id);
      if (error) throw error;
      toast({ title: 'Configurações salvas' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = async () => {
    if (!newQuestion.text.trim()) return;
    const stageList = newQuestion.stage === 1 ? stage1 : stage2;
    const nextOrder = (stageList[stageList.length - 1]?.order_num ?? 0) + 1;
    const { error } = await (supabase as any).from('hr_questions').insert({
      stage: newQuestion.stage,
      order_num: nextOrder,
      text: newQuestion.text.trim(),
    });
    if (error) {
      toast({ title: 'Erro ao adicionar pergunta', description: error.message, variant: 'destructive' });
      return;
    }
    setNewQuestion({ ...newQuestion, text: '' });
    toast({ title: 'Pergunta adicionada' });
  };

  const updateQuestionText = async (id: string, text: string) => {
    const { error } = await (supabase as any).from('hr_questions').update({ text }).eq('id', id);
    if (error) toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm('Remover esta pergunta? Respostas já registradas em entrevistas serão preservadas.')) return;
    const { error } = await (supabase as any).from('hr_questions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Pergunta removida' });
  };

  const moveQuestion = async (q: HRQuestion, dir: 'up' | 'down') => {
    const list = q.stage === 1 ? stage1 : stage2;
    const idx = list.findIndex(x => x.id === q.id);
    const swap = dir === 'up' ? list[idx - 1] : list[idx + 1];
    if (!swap) return;
    // Trick: usamos order_num temporário negativo para evitar colisão UNIQUE(stage, order_num)
    const tempOrder = -1 * Date.now();
    const { error: e1 } = await (supabase as any).from('hr_questions').update({ order_num: tempOrder }).eq('id', q.id);
    if (e1) { toast({ title: 'Erro', description: e1.message, variant: 'destructive' }); return; }
    await (supabase as any).from('hr_questions').update({ order_num: q.order_num }).eq('id', swap.id);
    await (supabase as any).from('hr_questions').update({ order_num: swap.order_num }).eq('id', q.id);
  };

  if (loading || !settings) {
    return (
      <Card className="p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Tabs defaultValue="notifications" className="space-y-4">
      <TabsList>
        <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" /> Notificações</TabsTrigger>
        <TabsTrigger value="templates" className="gap-2"><MessageSquare className="w-4 h-4" /> Templates</TabsTrigger>
        <TabsTrigger value="questions" className="gap-2"><ListChecks className="w-4 h-4" /> Perguntas</TabsTrigger>
      </TabsList>

      {/* ============ NOTIFICAÇÕES (TIMERS) ============ */}
      <TabsContent value="notifications">
        <Card className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Timers de envio automático</h3>
            <p className="text-sm text-muted-foreground">
              Define quando o lembrete será disparado antes da entrevista/reunião agendada.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="offset1">Lembrete 1 — antecedência (minutos)</Label>
              <Input
                id="offset1"
                type="number"
                min={1}
                value={settings.offset_1_minutes}
                onChange={(e) => setSettings({ ...settings, offset_1_minutes: parseInt(e.target.value || '0', 10) })}
              />
              <p className="text-xs text-muted-foreground">
                Equivale a <strong>{minutesToReadable(settings.offset_1_minutes)}</strong> antes do horário marcado.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="offset2">Lembrete 2 — antecedência (minutos)</Label>
              <Input
                id="offset2"
                type="number"
                min={1}
                value={settings.offset_2_minutes}
                onChange={(e) => setSettings({ ...settings, offset_2_minutes: parseInt(e.target.value || '0', 10) })}
              />
              <p className="text-xs text-muted-foreground">
                Equivale a <strong>{minutesToReadable(settings.offset_2_minutes)}</strong> antes do horário marcado.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            ⏰ Padrão recomendado: <strong>1440 minutos (24h)</strong> + <strong>30 minutos</strong> antes.
          </div>

          <Button onClick={saveSettings} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar timers
          </Button>
        </Card>
      </TabsContent>

      {/* ============ TEMPLATES ============ */}
      <TabsContent value="templates">
        <Card className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Templates de mensagem WhatsApp</h3>
            <p className="text-sm text-muted-foreground">
              Use os marcadores abaixo para personalizar dinamicamente.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {PLACEHOLDERS.map(p => (
                <Badge key={p.key} variant="secondary" className="font-mono text-xs">
                  {p.key} = {p.desc}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <TemplateEditor
              label="Template 1 (lembrete antecipado)"
              value={settings.template_1_text}
              onChange={(v) => setSettings({ ...settings, template_1_text: v })}
            />
            <TemplateEditor
              label="Template 2 (lembrete final)"
              value={settings.template_2_text}
              onChange={(v) => setSettings({ ...settings, template_2_text: v })}
            />
          </div>

          <Button onClick={saveSettings} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar templates
          </Button>
        </Card>
      </TabsContent>

      {/* ============ PERGUNTAS ============ */}
      <TabsContent value="questions">
        <Card className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold">Banco de perguntas das entrevistas</h3>
              <p className="text-sm text-muted-foreground">
                Edite, reordene ou adicione perguntas usadas nos formulários E1 e E2.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Total: {questions.length} perguntas
            </Badge>
          </div>

          {/* Adicionar nova */}
          <div className="rounded-lg border border-dashed border-border p-3 space-y-2 bg-muted/30">
            <Label className="text-xs">Adicionar nova pergunta</Label>
            <div className="flex gap-2 flex-wrap">
              <select
                value={newQuestion.stage}
                onChange={(e) => setNewQuestion({ ...newQuestion, stage: parseInt(e.target.value, 10) as 1 | 2 })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={1}>Entrevista 1</option>
                <option value={2}>Entrevista 2</option>
              </select>
              <Input
                placeholder="Texto da pergunta..."
                value={newQuestion.text}
                onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                className="flex-1 min-w-[260px]"
              />
              <Button onClick={addQuestion} disabled={!newQuestion.text.trim()} className="gap-2">
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <QuestionList
              title="Entrevista 1"
              questions={stage1}
              onUpdate={updateQuestionText}
              onDelete={deleteQuestion}
              onMove={moveQuestion}
            />
            <QuestionList
              title="Entrevista 2"
              questions={stage2}
              onUpdate={updateQuestionText}
              onDelete={deleteQuestion}
              onMove={moveQuestion}
            />
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function TemplateEditor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const preview = applyPreview(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="font-mono text-sm resize-none"
      />
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">📱 Preview ao vivo</div>
        <div className="text-sm whitespace-pre-wrap text-foreground">{preview || <span className="text-muted-foreground italic">vazio...</span>}</div>
      </div>
    </div>
  );
}

interface QListProps {
  title: string;
  questions: HRQuestion[];
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onMove: (q: HRQuestion, dir: 'up' | 'down') => void;
}

function QuestionList({ title, questions, onUpdate, onDelete, onMove }: QListProps) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        {title}
        <Badge variant="secondary" className="text-xs">{questions.length}</Badge>
      </h4>
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
        {questions.map((q, idx) => (
          <QuestionRow
            key={q.id}
            q={q}
            isFirst={idx === 0}
            isLast={idx === questions.length - 1}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onMove={onMove}
          />
        ))}
        {questions.length === 0 && (
          <p className="text-xs text-muted-foreground italic py-4 text-center">Nenhuma pergunta cadastrada.</p>
        )}
      </div>
    </div>
  );
}

function QuestionRow({
  q, isFirst, isLast, onUpdate, onDelete, onMove,
}: { q: HRQuestion; isFirst: boolean; isLast: boolean; onUpdate: (id: string, text: string) => void; onDelete: (id: string) => void; onMove: (q: HRQuestion, dir: 'up' | 'down') => void }) {
  const [text, setText] = useState(q.text);
  useEffect(() => { setText(q.text); }, [q.text]);

  return (
    <div className="flex items-start gap-1.5 p-2 rounded-md border border-border bg-card hover:border-primary/40 transition-colors">
      <div className="flex flex-col gap-0.5">
        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={isFirst} onClick={() => onMove(q, 'up')}>
          <ArrowUp className="w-3 h-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={isLast} onClick={() => onMove(q, 'down')}>
          <ArrowDown className="w-3 h-3" />
        </Button>
      </div>
      <span className="text-xs font-mono text-muted-foreground pt-2 min-w-[24px]">{q.order_num}.</span>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== q.text && onUpdate(q.id, text)}
        rows={2}
        className="text-sm resize-none flex-1 min-h-[40px]"
      />
      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(q.id)}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
