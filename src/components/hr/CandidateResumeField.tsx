import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileText, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  resumeUrl: string | null | undefined;
  uploading: boolean;
  onFileSelected: (file: File) => void;
}

/** Componente interno: gera URL assinada na hora de abrir o currículo (1h). */
function ResumeLink({ path }: { path: string }) {
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.storage
        .from('hr-resumes')
        .createSignedUrl(path, 60 * 60);
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
}

export function CandidateResumeField({ resumeUrl, uploading, onFileSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <Label className="text-xs">Currículo (PDF/DOC)</Label>
      <div className="flex items-center gap-2">
        {resumeUrl ? (
          resumeUrl.startsWith('http') ? (
            <a
              href={resumeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center gap-2 text-sm text-primary hover:underline truncate"
            >
              <FileText className="w-4 h-4 shrink-0" /> Ver currículo (legado)
            </a>
          ) : (
            <ResumeLink path={resumeUrl} />
          )
        ) : (
          <span className="flex-1 text-xs text-muted-foreground">Nenhum CV anexado</span>
        )}
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          {resumeUrl ? 'Trocar' : 'Enviar'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf"
          hidden
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
