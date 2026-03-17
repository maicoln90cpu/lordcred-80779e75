import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, Image, Mic, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
  media_url?: string | null;
  media_type?: string | null;
  media_filename?: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  saudacao: 'bg-green-500/20 text-green-400',
  vendas: 'bg-blue-500/20 text-blue-400',
  suporte: 'bg-purple-500/20 text-purple-400',
  cobranca: 'bg-orange-500/20 text-orange-400',
  followup: 'bg-yellow-500/20 text-yellow-400',
  encerramento: 'bg-red-500/20 text-red-400',
  geral: 'bg-muted text-muted-foreground',
};

const CATEGORY_LABELS: Record<string, string> = {
  saudacao: 'Saudação', vendas: 'Vendas', suporte: 'Suporte',
  cobranca: 'Cobrança', followup: 'Follow-up', encerramento: 'Encerramento', geral: 'Geral',
};

interface TemplatePickerProps {
  disabled?: boolean;
  onInsertText: (text: string) => void;
  onSendMedia: (mediaBase64: string, mediaType: string, caption: string, fileName?: string) => void;
}

export default function TemplatePicker({ disabled, onInsertText, onSendMedia }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('message_templates')
      .select('id, title, content, category, media_url, media_type, media_filename')
      .eq('is_active', true)
      .order('category')
      .order('sort_order')
      .then(({ data }) => {
        setTemplates((data as Template[]) || []);
        setLoading(false);
      });
  }, [open]);

  const filtered = templates.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (t: Template) => {
    if (t.media_url && t.media_type) {
      // Send media template
      setSendingId(t.id);
      try {
        const resp = await fetch(t.media_url);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          onSendMedia(base64, t.media_type!, t.content || '', t.media_filename || undefined);
          setOpen(false);
          setSendingId(null);
        };
        reader.readAsDataURL(blob);
      } catch {
        // Fallback: just insert text
        onInsertText(t.content);
        setOpen(false);
        setSendingId(null);
      }
    } else {
      onInsertText(t.content);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground shrink-0"
          disabled={disabled}
          title="Templates"
        >
          <FileText className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-0">
        <div className="p-3 border-b border-border/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar template..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum template</p>
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  disabled={sendingId === t.id}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[t.category] || CATEGORY_COLORS.geral}`}>
                      {CATEGORY_LABELS[t.category] || t.category}
                    </Badge>
                    {t.media_type === 'image' && <Image className="w-3 h-3 text-muted-foreground" />}
                    {(t.media_type === 'audio' || t.media_type === 'ptt') && <Mic className="w-3 h-3 text-muted-foreground" />}
                    {sendingId === t.id && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                  </div>
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.content}</p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
