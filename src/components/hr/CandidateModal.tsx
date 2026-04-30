import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useHRCandidates, type HRCandidate, type HRKanbanStatus } from '@/hooks/useHRCandidates';
import { useHREmployees } from '@/hooks/useHREmployees';
import { useHRKanbanColumns } from '@/hooks/useHRKanbanColumns';
import { InterviewForm } from './InterviewForm';
import { ScheduleModal } from './ScheduleModal';
import { CandidateActions } from './CandidateActions';
import { CandidateResumeField } from './CandidateResumeField';
import { CandidateHeader } from './CandidateHeader';
import { AccessCredentialsTab } from './AccessCredentialsTab';
import { validateBrazilianPhone, formatBrazilianPhone } from '@/lib/phoneUtils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: HRCandidate | null;
  entityType?: 'candidate' | 'employee';
}

export function CandidateModal({ open, onOpenChange, candidate, entityType = 'candidate' }: Props) {
  const { toast } = useToast();
  const { updateCandidate, deleteCandidate, moveToPartner } = useHRCandidates();
  const { updateEmployee, deleteEmployee } = useHREmployees();
  const { columns: kanbanColumns } = useHRKanbanColumns(entityType === 'candidate' ? 'candidates' : 'employees');

  const statusOptions = kanbanColumns.map(c => ({ value: c.slug, label: c.name }));

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

  const phoneCheck = form.phone
    ? validateBrazilianPhone(form.phone)
    : { valid: true, normalized: '', e164: '', reason: undefined as string | undefined };

  const handleSave = async () => {
    if (form.phone && !phoneCheck.valid) {
      toast({ title: 'Telefone inválido', description: phoneCheck.reason, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, phone: form.phone ? phoneCheck.normalized : form.phone };
      if (entityType === 'employee') {
        await updateEmployee(candidate.id, payload);
      } else {
        await updateCandidate(candidate.id, payload);
      }
      toast({ title: entityType === 'employee' ? 'Colaborador atualizado' : 'Candidato atualizado' });
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
    return path;
  };

  const handlePhotoUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Foto muito grande', description: 'Máximo 5 MB.', variant: 'destructive' });
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await handleUpload(file, 'hr-photos');
      setForm(prev => ({ ...prev, photo_url: url }));
      if (entityType === 'employee') await updateEmployee(candidate.id, { photo_url: url });
      else await updateCandidate(candidate.id, { photo_url: url });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar foto', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleResumeUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Currículo muito grande', description: 'Máximo 10 MB.', variant: 'destructive' });
      return;
    }
    setUploadingResume(true);
    try {
      const url = await handleUpload(file, 'hr-resumes');
      setForm(prev => ({ ...prev, resume_url: url }));
      if (entityType === 'employee') await updateEmployee(candidate.id, { resume_url: url });
      else await updateCandidate(candidate.id, { resume_url: url });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar CV', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingResume(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (entityType === 'employee') await deleteEmployee(candidate.id);
      else await deleteCandidate(candidate.id);
      onOpenChange(false);
    } catch { /* silent */ }
  };

  const handleMoveToPartner = async () => {
    try {
      await moveToPartner(candidate);
      onOpenChange(false);
    } catch { /* silent */ }
  };

  const isEmployee = entityType === 'employee';
  const tabCount = isEmployee ? 2 : 4; // employee: Dados + Acessos; candidate: Dados + E1 + E2 + Acessos

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="space-y-3 pb-2">
            <CandidateHeader
              candidate={candidate}
              photoUrl={form.photo_url}
              uploading={uploadingPhoto}
              onPhotoSelected={handlePhotoUpload}
            />
          </SheetHeader>

          <Tabs defaultValue="info" className="mt-4 space-y-4">
            <TabsList className={`w-full grid ${isEmployee ? 'grid-cols-2' : 'grid-cols-4'}`}>
              <TabsTrigger value="info">Dados</TabsTrigger>
              {!isEmployee && <TabsTrigger value="e1">Entrevista 1</TabsTrigger>}
              {!isEmployee && <TabsTrigger value="e2">Entrevista 2</TabsTrigger>}
              <TabsTrigger value="access">Acessos</TabsTrigger>
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
                    value={form.kanban_status || (isEmployee ? 'send_docs' : 'new_resume')}
                    onValueChange={(v) => setForm(p => ({ ...p, kanban_status: v as HRKanbanStatus }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(o => (
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

              <CandidateResumeField
                resumeUrl={form.resume_url}
                uploading={uploadingResume}
                onFileSelected={handleResumeUpload}
              />

              <CandidateActions
                candidate={candidate}
                saving={saving}
                onSave={handleSave}
                onScheduleE1={!isEmployee ? () => setScheduleStage(1) : undefined}
                onScheduleE2={!isEmployee ? () => setScheduleStage(2) : undefined}
                onMoveToPartner={!isEmployee ? handleMoveToPartner : undefined}
                onDelete={handleDelete}
              />
            </TabsContent>

            {!isEmployee && (
              <TabsContent value="e1">
                <InterviewForm candidate={candidate} stage={1} />
              </TabsContent>
            )}

            {!isEmployee && (
              <TabsContent value="e2">
                <InterviewForm candidate={candidate} stage={2} />
              </TabsContent>
            )}

            <TabsContent value="access">
              <AccessCredentialsTab entityType={entityType} entityId={candidate.id} />
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
