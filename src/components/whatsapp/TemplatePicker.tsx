import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Headphones, Search, Image, Mic, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
  media_url?: string | null;
  media_type?: string | null;
  media_filename?: string | null;
  trigger_word?: string | null;
}

interface TemplatePickerProps {
  disabled?: boolean;
  onInsertText: (text: string) => void;
  onLoadMedia: (base64: string, type: string, caption: string, fileName?: string) => void;
}

export default function TemplatePicker({ disabled, onInsertText, onLoadMedia }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('message_templates')
        .select('id, title, content, category, media_url, media_type, media_filename, visible_to, visible_to_list, created_by, trigger_word')
        .eq('is_active', true)
        .order('sort_order');
      let filtered = (data as any[] || []).map(d => ({ ...d } as Template & { created_by?: string; visible_to_list?: string[]; trigger_word?: string }));
      if (user) {
        const { data: nonSellerIds } = await supabase.rpc('get_non_seller_user_ids' as any);
        const nonSellerSet = new Set<string>((nonSellerIds as string[]) || []);
        const isSeller = !nonSellerSet.has(user.id);

        filtered = filtered.filter(t => {
          if ((t as any).created_by === user.id) return true;
          if (isSeller) {
            if (!nonSellerSet.has((t as any).created_by)) return false;
          }
          const list = (t as any).visible_to_list;
          if (list && list.length > 0) return list.includes(user.id);
          if ((t as any).visible_to) return (t as any).visible_to === user.id;
          return true;
        });
      }
      setTemplates(filtered);
      setLoading(false);
    })();
  }, [open]);

  const filteredTemplates = templates.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.trigger_word || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (t: Template) => {
    if (t.media_url && t.media_type) {
      setSendingId(t.id);
      try {
        const resp = await fetch(t.media_url);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const loadType = t.media_type === 'audio' ? 'ptt' : t.media_type!;
          onLoadMedia(base64, loadType, t.content || '', t.media_filename || undefined);
          setOpen(false);
          setSendingId(null);
        };
        reader.readAsDataURL(blob);
      } catch {
        if (t.content) onInsertText(t.content);
        setOpen(false);
        setSendingId(null);
      }
    } else if (t.content) {
      onInsertText(t.content);
      setOpen(false);
    } else {
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
          <Headphones className="w-5 h-5" />
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
          ) : filteredTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum template</p>
          ) : (
            <div className="p-2 space-y-1">
              {filteredTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  disabled={sendingId === t.id}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {t.media_type === 'image' && <Image className="w-3 h-3 text-muted-foreground" />}
                    {(t.media_type === 'audio' || t.media_type === 'ptt') && <Mic className="w-3 h-3 text-muted-foreground" />}
                    {sendingId === t.id && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                  </div>
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  {t.trigger_word && (
                    <p className="text-xs text-primary mt-0.5">⚡ Gatilho: <span className="font-mono font-semibold">{t.trigger_word}</span></p>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
