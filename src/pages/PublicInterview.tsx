import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Question {
  id: string;
  text: string;
  order_num: number;
  stage: number;
}

interface PageData {
  candidate: { id: string; full_name: string } | null;
  stage: number;
  questions: Question[];
  answers: Record<string, string>;
  already_submitted: boolean;
}

export default function PublicInterview() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PageData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.title = 'Entrevista — LordCred';
    if (!token) return;
    (async () => {
      try {
        const { data: result, error: fnErr } = await supabase.functions.invoke(
          'hr-interview-public-get',
          { body: { token } },
        );
        if (fnErr) {
          setError(fnErr.message || 'Erro ao carregar entrevista');
        } else if (result?.error) {
          setError(result.error);
        } else {
          setData(result);
          setAnswers(result.answers || {});
        }
      } catch (e: any) {
        setError(e.message || 'Erro inesperado');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubmit = async () => {
    if (!data || !token) return;
    const payload = data.questions.map(q => ({
      question_id: q.id,
      answer: answers[q.id] || '',
    }));
    setSubmitting(true);
    try {
      const { data: result, error: fnErr } = await supabase.functions.invoke(
        'hr-interview-public-submit',
        { body: { token, answers: payload } },
      );
      if (fnErr || result?.error) {
        toast({ title: 'Erro ao enviar', description: fnErr?.message || result?.error, variant: 'destructive' });
      } else {
        setSubmitted(true);
        toast({ title: 'Respostas enviadas com sucesso!' });
      }
    } catch (e: any) {
      toast({ title: 'Erro inesperado', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando entrevista...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Não foi possível abrir a entrevista
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Entre em contato com o recrutador que enviou o link para receber um novo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-success/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-5 h-5" /> Respostas enviadas!
            </CardTitle>
            <CardDescription>
              Obrigado, {data?.candidate?.full_name}. Recebemos suas respostas e o recrutador será notificado.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Entrevista {data.stage}</h1>
          <p className="text-sm text-muted-foreground">
            Olá <span className="font-semibold text-foreground">{data.candidate?.full_name}</span>! Responda as perguntas abaixo com calma e clique em <span className="font-semibold">Enviar</span> ao final.
          </p>
          {data.already_submitted && (
            <div className="text-xs text-warning mt-2">
              ⚠ Você já enviou respostas anteriormente. Ao reenviar, suas respostas serão atualizadas.
            </div>
          )}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {data.questions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma pergunta cadastrada para esta etapa.
              </p>
            )}
            {data.questions.map(q => (
              <div key={q.id} className="space-y-1.5">
                <Label className="text-sm leading-snug">
                  <span className="text-muted-foreground mr-1">{q.order_num}.</span>
                  {q.text}
                </Label>
                <Textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  rows={3}
                  maxLength={5000}
                  placeholder="Sua resposta..."
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting || data.questions.length === 0} size="lg" className="gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar respostas
          </Button>
        </div>

        <p className="text-[10px] text-center text-muted-foreground">
          LordCred · Recrutamento
        </p>
      </div>
    </div>
  );
}
