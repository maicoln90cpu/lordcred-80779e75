import { MessageSquare, Upload, FileText, Trash2, ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { WarmingMessage } from '@/hooks/useSettingsData';

interface Props {
  messages: WarmingMessage[];
  showAllMessages: boolean;
  setShowAllMessages: (v: boolean) => void;
  csvInputRef: React.RefObject<HTMLInputElement>;
  onCsvUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAll: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export default function SettingsMessagesTab({ messages, showAllMessages, setShowAllMessages, csvInputRef, onCsvUpload, onRemoveAll, onSave, isSaving }: Props) {
  const sorted = [...messages].sort((a, b) => (a.message_order || 0) - (b.message_order || 0));
  const displayed = showAllMessages ? sorted : sorted.slice(0, 5);

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Arquivo de Mensagens
          </CardTitle>
          <CardDescription>Faça upload de um arquivo CSV com as mensagens de aquecimento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input type="file" accept=".csv" ref={csvInputRef} onChange={onCsvUpload} className="hidden" />

          {messages.length === 0 ? (
            <div
              className="border-2 border-dashed border-border/50 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => csvInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium">Importe um arquivo CSV</p>
              <p className="text-sm text-muted-foreground mt-1">Uma mensagem por linha.</p>
              <Button variant="outline" className="mt-4"><Upload className="w-4 h-4 mr-2" />Selecionar arquivo</Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10"><FileText className="w-6 h-6 text-primary" /></div>
                  <div>
                    <p className="font-medium text-sm">{(messages[0] as any)?.source_file || 'mensagens.csv'}</p>
                    <p className="text-xs text-muted-foreground">{messages.length} mensagens • {messages.filter(m => m.is_active).length} ativas</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Substituir</Button>
                  <Button variant="destructive" size="sm" onClick={onRemoveAll}><Trash2 className="w-4 h-4 mr-2" />Remover</Button>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Preview das mensagens:</p>
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {displayed.map((msg, i) => (
                    <div key={msg.id} className="flex items-center gap-2 text-sm p-2 rounded bg-background/50">
                      <span className="text-xs text-muted-foreground font-mono w-8 shrink-0">#{(msg.message_order || i) + 1}</span>
                      <p className="flex-1 truncate">{msg.content}</p>
                    </div>
                  ))}
                </div>
                {messages.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowAllMessages(!showAllMessages)}>
                    {showAllMessages ? <><ChevronUp className="w-4 h-4 mr-1" />Mostrar menos</> : <><ChevronDown className="w-4 h-4 mr-1" />Ver todas ({messages.length} mensagens)</>}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} size="lg" disabled={isSaving}>
          {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : <><Save className="w-4 h-4 mr-2" />Salvar Alterações</>}
        </Button>
      </div>
    </div>
  );
}
