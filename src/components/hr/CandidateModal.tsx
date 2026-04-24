import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Calendar, Camera, FileText, Loader2, Save, Trash2, UserPlus, Upload,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHRCandidates, type HRCandidate, type HRKanbanStatus } from '@/hooks/useHRCandidates';
import { InterviewForm } from './InterviewForm';
import { ScheduleModal } from './ScheduleModal';
import { validateBrazilianPhone, formatBrazilianPhone } from '@/lib/phoneUtils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: HRCandidate | null;
}

const STATUS_OPTIONS: { value: HRKanbanStatus; label: string }[] = [
  { value: 'new_resume', label: 'Currículo novo' },
  { value: 'contacted', label: 'Contatado' },
  { value: 'scheduled_e1', label: 'E1 agendada' },
  { value: 'done_e1', label: 'E1 realizada' },
  { value: 'scheduled_e2', label: 'E2 agendada' },
  { value: 'done_e2', label: 'E2 realizada' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'rejected', label: 'Reprovado' },
  { value: 'doubt', label: 'Dúvida' },
  { value: 'became_partner', label: 'Virou parceiro' },
];

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('') || '?';
}

export function CandidateModal({ open, onOpenChange, candidate }: Props) {
  const { toast } = useToast();
  const { updateCandidate, deleteCandidate, moveToPartner } = useHRCandidates();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Partial<HRCandidate>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [scheduleStage, setScheduleStage] = useState<1 | 2 | null>(null);

  useEffect(() => {
    if (candidate) {
      setForm({
        full_name: candidate.full_name,
        phone: candidate.phone,
        age: candidate.age,
        cpf: candidate.cpf,
        type: candidate.type,
        kanban_status: candidate.kanban_status,
        notes: candidate.notes,
        photo_url: candidate.photo_url,
        resume_url: candidate.resume_url,
      });
    }
  }, [candidate]);

  if (!candidate) return null;

  // Validação ao vivo do telefone (aceita vazio para permitir limpar campo)
  const phoneCheck = form.phone ? validateBrazilianPhone(form.phone) : { valid: true, normalized: '', e164: '', reason: undefined as string | undefined };

  const handleSave = async () => {
    if (form.phone && !phoneCheck.valid) {
      toast({ title: 'Telefone inválido', description: phoneCheck.reason, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Persiste telefone normalizado (sem 55, apenas DDD+número) — sistema adiciona 55 quando precisar enviar
      const payload = { ...form, phone: form.phone ? phoneCheck.normalized : form.phone };
      await updateCandidate(candidate.id, payload);
      toast({ title: 'Candidato atualizado' });
    } catch { /* hook handles toast */ }
    finally { setSaving(false); }
  };

  const handleUpload = async (file: File, bucket: 'hr-photos' | 'hr-resumes') => {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${candidate.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    if (bucket === 'hr-photos') {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    }
    // hr-resumes: salvamos APENAS o path. URL assinada é gerada sob demanda
    // pelo componente ResumeLink (1h de validade), evitando links que expiram após 30 dias.
    return path;
  };

  // Componente interno: gera URL assinada na hora de abrir o currículo
  const ResumeLink = ({ path }: { path: string }) => {
    const [opening, setOpening] = useState(false);
    const open = async () => {
      setOpening(true);
      try {
        const { data, error } = await supabase.storage
          .from('hr-resumes')
          .createSignedUrl(path, 60 * 60); // 1 hora
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      } catch (err: any) {
        toast({ title: 'Erro ao abrir currículo', description: err.message, variant: 'destructive' });
      } finally {
        setOpening(false);
      }
    };
    return (
      <button
        onClick={open}
        disabled={opening}
        className="flex-1 flex items-center gap-2 text-sm text-primary hover:underline truncate text-left"
      >
        {opening ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> : <FileText className="w-4 h-4 shrink-0" />}
        Ver currículo
      </button>
    );
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Foto muito grande', description: 'Máximo 5 MB.', variant: 'destructive' });
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await handleUpload(file, 'hr-photos');
      setForm(prev => ({ ...prev, photo_url: url }));
      await updateCandidate(candidate.id, { photo_url: url });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar foto', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Currículo muito grande', description: 'Máximo 10 MB.', variant: 'destructive' });
      return;
    }
    setUploadingResume(true);
    try {
      const url = await handleUpload(file, 'hr-resumes');
      setForm(prev => ({ ...prev, resume_url: url }));
      await updateCandidate(candidate.id, { resume_url: url });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar CV', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingResume(false);
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCandidate(candidate.id);
      onOpenChange(false);
    } catch { /* silent */ }
  };

  const handleMoveToPartner = async () => {
    try {
      await moveToPartner(candidate);
      onOpenChange(false);
    } catch { /* silent */ }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="space-y-3 pb-2">
            <div className="flex items-start gap-3">
              <div className="relative">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={form.photo_url || undefined} alt={candidate.full_name} />
                  <AvatarFallback className="text-lg">{getInitials(candidate.full_name)}</AvatarFallback>
                </Avatar>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                  title="Trocar foto"
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={handlePhotoChange} />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <SheetTitle className="text-left text-xl truncate">{candidate.full_name}</SheetTitle>
                <SheetDescription className="text-left flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {candidate.type === 'partner' ? 'Parceiro' : 'CLT'}
                  </Badge>
                  <span className="text-xs">
                    {STATUS_OPTIONS.find(s => s.value === candidate.kanban_status)?.label}
                  </span>
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <Tabs defaultValue="info" className="mt-4 space-y-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="info">Dados</TabsTrigger>
              <TabsTrigger value="e1">Entrevista 1</TabsTrigger>
              <TabsTrigger value="e2">Entrevista 2</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nome completo</Label>
                  <Input
                    value={form.full_name || ''}
                    onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                    maxLength={150}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input
                    value={form.phone || ''}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                    maxLength={20}
                    className={form.phone && !phoneCheck.valid ? 'border-destructive focus-visible:ring-destructive' : ''}
                  />
                  {form.phone && !phoneCheck.valid && (
                    <p className="text-[11px] text-destructive">{phoneCheck.reason}</p>
                  )}
                  {form.phone && phoneCheck.valid && phoneCheck.e164 && (
                    <p className="text-[11px] text-muted-foreground">
                      {formatBrazilianPhone(phoneCheck.normalized)} → +{phoneCheck.e164}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf || ''}
                    onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Idade</Label>
                  <Input
                    type="number" min={16} max={99}
                    value={form.age ?? ''}
                    onChange={e => setForm(p => ({ ...p, age: e.target.value ? parseInt(e.target.value, 10) : null }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select
                    value={form.type || 'clt'}
                    onValueChange={(v) => setForm(p => ({ ...p, type: v as 'clt' | 'partner' }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clt">CLT</SelectItem>
                      <SelectItem value="partner">Parceiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Status no funil</Label>
                  <Select
                    value={form.kanban_status || 'new_resume'}
                    onValueChange={(v) => setForm(p => ({ ...p, kanban_status: v as HRKanbanStatus }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea
                    value={form.notes || ''}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    maxLength={2000}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <Label className="text-xs">Currículo (PDF/DOC)</Label>
                <div className="flex items-center gap-2">
                  {form.resume_url ? (
                    form.resume_url.startsWith('http') ? (
                      // Legado: candidatos antigos têm URL assinada salva diretamente
                      <a href={form.resume_url} target="_blank" rel="noreferrer"
                         className="flex-1 flex items-center gap-2 text-sm text-primary hover:underline truncate">
                        <FileText className="w-4 h-4 shrink-0" /> Ver currículo (legado)
                      </a>
                    ) : (
                      <ResumeLink path={form.resume_url} />
                    )
                  ) : (
                    <span className="flex-1 text-xs text-muted-foreground">Nenhum CV anexado</span>
                  )}
                  <Button size="sm" variant="outline" onClick={() => resumeInputRef.current?.click()} disabled={uploadingResume}>
                    {uploadingResume ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                    {form.resume_url ? 'Trocar' : 'Enviar'}
                  </Button>
                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf"
                    hidden
                    onChange={handleResumeChange}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar dados
                </Button>
                <Button variant="outline" onClick={() => setScheduleStage(1)} className="gap-1.5">
                  <Calendar className="w-4 h-4" /> Agendar E1
                </Button>
                <Button variant="outline" onClick={() => setScheduleStage(2)} className="gap-1.5">
                  <Calendar className="w-4 h-4" /> Agendar E2
                </Button>
                {candidate.kanban_status === 'approved' && candidate.type === 'partner' && (
                  <Button variant="secondary" onClick={handleMoveToPartner} className="gap-1.5">
                    <UserPlus className="w-4 h-4" /> Mover para Parceiros
                  </Button>
                )}
                <div className="ml-auto">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="gap-1.5">
                        <Trash2 className="w-4 h-4" /> Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover candidato?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação removerá <b>{candidate.full_name}</b> e todas as entrevistas/respostas associadas. Não pode ser desfeito.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="e1">
              <InterviewForm candidate={candidate} stage={1} />
            </TabsContent>

            <TabsContent value="e2">
              <InterviewForm candidate={candidate} stage={2} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {scheduleStage !== null && (
        <ScheduleModal
          open={scheduleStage !== null}
          onOpenChange={(o) => !o && setScheduleStage(null)}
          candidate={candidate}
          stage={scheduleStage}
        />
      )}
    </>
  );
}
