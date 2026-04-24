import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHRInterviews, type HRCandidate } from '@/hooks/useHRCandidates';
import { useHRNotifications } from '@/hooks/useHRNotifications';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: HRCandidate;
  stage: 1 | 2;
  onScheduled?: () => void;
}

interface InterviewerOption {
  user_id: string;
  name: string;
  phone?: string;
}

interface ChipOption {
  id: string;
  label: string;
}

export function ScheduleModal({ open, onOpenChange, candidate, stage, onScheduled }: Props) {
  const { toast } = useToast();
  const { saveInterview } = useHRInterviews(candidate.id);
  const { scheduleNotifications, settings } = useHRNotifications();

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('14:00');
  const [interviewerId, setInterviewerId] = useState<string>('');
  const [chipId, setChipId] = useState<string>('');
  const [notifyCandidate, setNotifyCandidate] = useState(true);
  const [notifyInterviewer, setNotifyInterviewer] = useState(true);
  const [interviewers, setInterviewers] = useState<InterviewerOption[]>([]);
  const [chips, setChips] = useState<ChipOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Load interviewers (admin/manager/support/master)
    (async () => {
      const { data: ids } = await (supabase as any).rpc('get_non_seller_user_ids');
      if (ids && Array.isArray(ids)) {
        const userIds = ids as string[];
        const { data: profs } = await (supabase as any)
          .from('profiles')
          .select('user_id, name, phone')
          .in('user_id', userIds);
        setInterviewers(((profs as any) || []).map((p: any) => ({
          user_id: p.user_id, name: p.name || p.user_id, phone: p.phone || null,
        })));
      }
      // Load chips for sending notifications
      const { data: chipsData } = await supabase
        .from('chips')
        .select('id, nickname, instance_name, phone_number')
        .eq('status', 'connected');
      setChips(((chipsData as any) || []).map((c: any) => ({
        id: c.id,
        label: c.nickname || c.phone_number || c.instance_name,
      })));
    })();
  }, [open]);

  const recipientType = notifyCandidate && notifyInterviewer
    ? 'both' : notifyCandidate ? 'candidate' : 'interviewer';

  const canSave = !!date && !!time && !!interviewerId && (
    !(notifyCandidate || notifyInterviewer) || !!chipId
  );

  const handleSave = async () => {
    if (!date) return;
    setSaving(true);
    try {
      // Build ISO datetime in São Paulo timezone (-03:00)
      const [hh, mm] = time.split(':').map(n => parseInt(n, 10));
      const dt = new Date(date);
      dt.setHours(hh, mm, 0, 0);
      // Build ISO with local components but explicit -03:00 suffix
      const iso = `${format(dt, 'yyyy-MM-dd')}T${time}:00-03:00`;

      // 1) Create or update interview row
      const interviewId = await saveInterview(
        {
          stage,
          interviewer_id: interviewerId,
          scheduled_at: iso,
        },
        [], // no answers yet
      );

      // 2) Schedule notifications if requested and chip selected
      if ((notifyCandidate || notifyInterviewer) && chipId && interviewId) {
        if (!settings) {
          toast({
            title: 'Notificações não configuradas',
            description: 'Configure os timers em Configurações de RH antes de agendar lembretes.',
            variant: 'destructive',
          });
        } else {
          const interviewer = interviewers.find(i => i.user_id === interviewerId);
          await scheduleNotifications({
            entity_type: 'interview',
            entity_id: interviewId as string,
            scheduled_at: iso,
            recipient_type: recipientType,
            phone_candidate: notifyCandidate ? candidate.phone : null,
            phone_interviewer: notifyInterviewer ? (interviewer?.phone ?? null) : null,
            chip_instance_id: chipId,
          });
        }
      }

      toast({ title: `E${stage} agendada com sucesso` });
      onScheduled?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('ScheduleModal error:', err);
      toast({ title: 'Erro ao agendar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Entrevista E{stage}</DialogTitle>
          <DialogDescription>
            {candidate.full_name} — defina data, horário e quem conduzirá a entrevista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd 'de' LLL", { locale: ptBR }) : 'Escolha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    locale={ptBR}
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Horário</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Entrevistador</Label>
            <Select value={interviewerId} onValueChange={setInterviewerId}>
              <SelectTrigger><SelectValue placeholder="Quem vai conduzir" /></SelectTrigger>
              <SelectContent>
                {interviewers.map(i => (
                  <SelectItem key={i.user_id} value={i.user_id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(() => {
            const selectedInterviewer = interviewers.find(i => i.user_id === interviewerId);
            const interviewerHasPhone = !!selectedInterviewer?.phone;
            return (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notif-cand" className="text-sm font-medium cursor-pointer">
                Notificar candidato (WhatsApp)
              </Label>
              <Switch id="notif-cand" checked={notifyCandidate} onCheckedChange={setNotifyCandidate} />
            </div>
            <div className="flex items-center justify-between">
              <Label
                htmlFor="notif-int"
                className={cn(
                  'text-sm font-medium cursor-pointer',
                  !interviewerHasPhone && 'text-muted-foreground'
                )}
              >
                Notificar entrevistador (WhatsApp)
              </Label>
              <Switch
                id="notif-int"
                checked={notifyInterviewer && interviewerHasPhone}
                onCheckedChange={setNotifyInterviewer}
                disabled={!interviewerHasPhone}
              />
            </div>
            {interviewerId && !interviewerHasPhone && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 -mt-1.5">
                Este entrevistador não tem telefone WhatsApp cadastrado em "Meu Perfil".
              </p>
            )}

            {(notifyCandidate || (notifyInterviewer && interviewerHasPhone)) && (
              <div className="space-y-1.5 pt-1.5 border-t border-border/60">
                <Label>Chip de envio</Label>
                <Select value={chipId} onValueChange={setChipId}>
                  <SelectTrigger><SelectValue placeholder="Escolha um chip conectado" /></SelectTrigger>
                  <SelectContent>
                    {chips.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum chip conectado</div>
                    )}
                    {chips.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {settings && (
                  <p className="text-[11px] text-muted-foreground">
                    Lembretes serão disparados {settings.offset_1_minutes} min e {settings.offset_2_minutes} min antes.
                  </p>
                )}
              </div>
            )}
          </div>
            );
          })()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
