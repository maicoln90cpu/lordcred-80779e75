import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Save, Pencil, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHRInterviews, type HRCandidate, type HRInterview } from '@/hooks/useHRCandidates';
import { PublicInterviewLinkDialog } from './PublicInterviewLinkDialog';


interface Props {
  candidate: HRCandidate;
  stage: 1 | 2;
  onSaved?: () => void;
}

const RESULT_OPTIONS = [
  { value: 'pending', label: '⏳ Aguardando avaliação' },
  { value: 'approved', label: '✅ Aprovado' },
  { value: 'rejected', label: '❌ Reprovado' },
  { value: 'doubt', label: '🤔 Dúvida' },
];

export function InterviewForm({ candidate, stage, onSaved }: Props) {
  const { toast } = useToast();
  const { interviews, questions, loading, saveInterview, fetchAnswers } = useHRInterviews(candidate.id);

  const interview = useMemo(
    () => interviews.find(i => i.stage === stage),
    [interviews, stage],
  );

  const stageQuestions = useMemo(
    () => questions.filter(q => q.stage === stage),
    [questions, stage],
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [snapshots, setSnapshots] = useState<Record<string, string | null>>({});
  const [observations, setObservations] = useState('');
  const [result, setResult] = useState<string>('pending');
  const [attended, setAttended] = useState<string>('yes');
  const [scoreTec, setScoreTec] = useState(5);
  const [scoreCul, setScoreCul] = useState(5);
  const [scoreEng, setScoreEng] = useState(5);
  const [saving, setSaving] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);


  // Load existing data when interview changes
  useEffect(() => {
    if (!interview) {
      setAnswers({});
      setSnapshots({});
      setObservations('');
      setResult('pending');
      setAttended('yes');
      setScoreTec(5);
      setScoreCul(5);
      setScoreEng(5);
      return;
    }
    setObservations(interview.observations || '');
    setResult(interview.result || 'pending');
    setAttended(interview.attended === false ? 'no' : 'yes');
    if (stage === 1) {
      setScoreTec(interview.score_tecnica ?? 5);
      setScoreCul(interview.score_cultura ?? 5);
      setScoreEng(interview.score_energia ?? 5);
    }
    fetchAnswers(interview.id).then(rows => {
      const map: Record<string, string> = {};
      const snapMap: Record<string, string | null> = {};
      rows.forEach(r => {
        if (r.answer) map[r.question_id] = r.answer;
        snapMap[r.question_id] = r.question_text_snapshot ?? null;
      });
      setAnswers(map);
      setSnapshots(snapMap);
    }).catch(() => { /* silent */ });
  }, [interview, stage, fetchAnswers]);

  const avgScore = stage === 1
    ? Math.round(((scoreTec + scoreCul + scoreEng) / 3) * 10) / 10
    : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: Partial<HRInterview> & { stage: 1 | 2 } = {
        id: interview?.id,
        stage,
        interviewer_id: interview?.interviewer_id ?? null,
        scheduled_at: interview?.scheduled_at ?? null,
        attended: attended === 'yes',
        result,
        observations,
      };
      if (stage === 1) {
        patch.score_tecnica = scoreTec;
        patch.score_cultura = scoreCul;
        patch.score_energia = scoreEng;
      }
      const questionTextById = new Map(stageQuestions.map(q => [q.id, q.text]));
      const answerRows = Object.entries(answers).map(([question_id, answer]) => ({
        question_id,
        answer,
        question_text_snapshot: questionTextById.get(question_id) ?? null,
      }));
      await saveInterview(patch, answerRows);
      onSaved?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar entrevista', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando entrevista...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!interview && (
        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          Nenhuma E{stage} registrada. Use o botão "Agendar E{stage}" no topo do candidato. Você ainda pode preencher campos abaixo e salvar para registrar manualmente.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Compareceu?</Label>
          <Select
            value={attended}
            onValueChange={(v) => {
              setAttended(v);
              // Auto-Reprovado quando marcar "não compareceu" (item 11.5)
              if (v === 'no') setResult('rejected');
              else if (result === 'rejected' && attended === 'no') setResult('pending');
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Sim, compareceu</SelectItem>
              <SelectItem value="no">Não compareceu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Resultado</Label>
          <Select value={result} onValueChange={setResult} disabled={attended === 'no'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RESULT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {attended === 'no' && (
            <p className="text-[10px] text-muted-foreground">
              Resultado fixado em <span className="font-medium text-destructive">Reprovado</span> automaticamente.
            </p>
          )}
        </div>
      </div>

      {attended === 'no' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-muted-foreground">
          ❌ Candidato não compareceu. Perguntas e avaliação foram ocultadas. Use as observações abaixo para registrar detalhes (motivo, reagendamento, etc.).
        </div>
      )}

      {stage === 1 && attended === 'yes' && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Avaliação (1 a 10)</h4>
            <span className="text-xs text-muted-foreground">
              Média: <span className="font-bold text-foreground">{avgScore}</span>
            </span>
          </div>
          {[
            { label: 'Técnica', value: scoreTec, setter: setScoreTec },
            { label: 'Cultura', value: scoreCul, setter: setScoreCul },
            { label: 'Energia', value: scoreEng, setter: setScoreEng },
          ].map(s => (
            <div key={s.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{s.label}</Label>
                <span className="text-xs font-bold tabular-nums">{s.value}</span>
              </div>
              <Slider
                min={1} max={10} step={1}
                value={[s.value]}
                onValueChange={(v) => s.setter(v[0])}
              />
            </div>
          ))}
        </div>
      )}

      {stageQuestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Perguntas</h4>
          {stageQuestions.map(q => {
            const snap = snapshots[q.id];
            const wasEdited = !!snap && snap.trim() !== q.text.trim();
            return (
              <div key={q.id} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <Label className="text-xs leading-snug flex-1">
                    <span className="text-muted-foreground mr-1">{q.order_num}.</span>
                    {q.text}
                  </Label>
                  {wasEdited && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="shrink-0 gap-1 text-[10px] py-0 h-5 border-warning/50 text-warning">
                            <Pencil className="w-2.5 h-2.5" />
                            pergunta editada
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p className="text-xs font-semibold mb-1">Texto original (no momento da resposta):</p>
                          <p className="text-xs text-muted-foreground">{snap}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Resposta..."
                  rows={2}
                  maxLength={2000}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Observações livres</Label>
        <Textarea
          value={observations}
          onChange={e => setObservations(e.target.value)}
          placeholder="Comentários do entrevistador..."
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className="flex justify-between items-center pt-1 gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            // Auto-create an empty interview record if none exists, so the link dialog can attach a token to it
            if (!interview?.id) {
              try {
                setGeneratingLink(true);
                await saveInterview({ stage }, []);
                // saveInterview triggers refetch; the dialog will pick up the new interview.id on next render
                toast({ title: 'Entrevista criada', description: 'Agora você pode gerar o link público.' });
                // small delay to ensure refetch finished and interview state populated
                setTimeout(() => setLinkDialogOpen(true), 350);
              } catch (err: any) {
                toast({ title: 'Erro ao preparar link', description: err.message, variant: 'destructive' });
              } finally {
                setGeneratingLink(false);
              }
            } else {
              setLinkDialogOpen(true);
            }
          }}
          disabled={generatingLink}
          className="gap-2"
          title={!interview?.id ? 'Cria a entrevista vazia e abre o gerador de link' : 'Gerar link público'}
        >
          {generatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Link público E{stage}
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar E{stage}
        </Button>
      </div>

      <PublicInterviewLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        interviewId={interview?.id}
        candidateId={candidate.id}
        candidateName={candidate.full_name}
        candidatePhone={candidate.phone}
        stage={stage}
      />
    </div>
  );
}
