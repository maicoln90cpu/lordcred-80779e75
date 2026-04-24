import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Save, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useHRInterviews, type HRCandidate, type HRInterview } from '@/hooks/useHRCandidates';

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
  const [observations, setObservations] = useState('');
  const [result, setResult] = useState<string>('pending');
  const [attended, setAttended] = useState<string>('yes');
  const [scoreTec, setScoreTec] = useState(5);
  const [scoreCul, setScoreCul] = useState(5);
  const [scoreEng, setScoreEng] = useState(5);
  const [saving, setSaving] = useState(false);

  // Load existing data when interview changes
  useEffect(() => {
    if (!interview) {
      setAnswers({});
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
      rows.forEach(r => { if (r.answer) map[r.question_id] = r.answer; });
      setAnswers(map);
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
      const answerRows = Object.entries(answers).map(([question_id, answer]) => ({
        question_id, answer,
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
          <Select value={attended} onValueChange={setAttended}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Sim, compareceu</SelectItem>
              <SelectItem value="no">Não compareceu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Resultado</Label>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RESULT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {stage === 1 && (
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
          {stageQuestions.map(q => (
            <div key={q.id} className="space-y-1.5">
              <Label className="text-xs leading-snug">
                <span className="text-muted-foreground mr-1">{q.order_num}.</span>
                {q.text}
              </Label>
              <Textarea
                value={answers[q.id] || ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Resposta..."
                rows={2}
                maxLength={2000}
              />
            </div>
          ))}
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

      <div className="flex justify-end pt-1">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar E{stage}
        </Button>
      </div>
    </div>
  );
}
