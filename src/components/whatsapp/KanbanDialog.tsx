import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Settings2, Loader2, LayoutGrid } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useKanban } from '@/hooks/useKanban';
import type { KanbanCard as KanbanCardType } from '@/hooks/useKanban';
import KanbanColumn from './KanbanColumn';
import KanbanCardDetailDialog from './KanbanCardDetailDialog';
import KanbanSettingsDialog from './KanbanSettingsDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChat: (chipId: string, remoteJid: string) => void;
}

interface LabelItem {
  label_id: string;
  name: string;
  color_hex: string | null;
}

export default function KanbanDialog({ open, onOpenChange, onOpenChat }: Props) {
  const { isAdmin, user } = useAuth();
  const { columns, loading, moveCard, removeCard, getVisibleCards, createColumn, updateColumn, deleteColumn, reorderColumns, refetch } = useKanban();
  const [search, setSearch] = useState('');
  const [chipFilter, setChipFilter] = useState<string>('all');
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailCard, setDetailCard] = useState<KanbanCardType | null>(null);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [chips, setChips] = useState<{ id: string; nickname: string | null; phone_number: string | null }[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    refetch();
    supabase.from('chips').select('id, nickname, phone_number').eq('user_id', user.id).then(({ data }) => setChips(data || []));
    supabase.from('labels').select('label_id, name, color_hex').then(({ data }) => setLabels(data || []));
  }, [open, user, refetch]);

  const filteredByColumn = useMemo(() => {
    const result: Record<string, KanbanCardType[]> = {};
    for (const col of columns) {
      let colCards = getVisibleCards(col.id);

      if (search.trim()) {
        const q = search.toLowerCase();
        colCards = colCards.filter(c => {
          const conv = c.conversation;
          if (!conv) return false;
          return (conv.contact_name || '').toLowerCase().includes(q)
            || (conv.wa_name || '').toLowerCase().includes(q)
            || (conv.contact_phone || '').includes(q)
            || conv.remote_jid.includes(q);
        });
      }

      if (chipFilter !== 'all') {
        colCards = colCards.filter(c => c.conversation?.chip_id === chipFilter);
      }

      if (labelFilter !== 'all') {
        colCards = colCards.filter(c => (c.conversation?.label_ids || []).includes(labelFilter));
      }

      colCards.sort((a, b) => {
        const da = a.conversation?.last_message_at || a.created_at;
        const db = b.conversation?.last_message_at || b.created_at;
        return new Date(db).getTime() - new Date(da).getTime();
      });

      result[col.id] = colCards;
    }
    return result;
  }, [columns, getVisibleCards, search, chipFilter, labelFilter]);

  const totalCards = useMemo(() =>
    Object.values(filteredByColumn).reduce((sum, arr) => sum + arr.length, 0),
    [filteredByColumn]
  );

  const handleDrop = (cardId: string, columnId: string) => moveCard(cardId, columnId);

  const handleRemoveCard = (cardId: string) => {
    removeCard(cardId);
    setDetailCard(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Premium header */}
          <div className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0 bg-gradient-to-b from-card to-background">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight">Kanban</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{totalCards} contato{totalCards !== 1 ? 's' : ''} em {columns.length} coluna{columns.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-1 max-w-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar contato..."
                    className="pl-9 h-9 text-sm bg-secondary/40 border-border/30 focus-visible:ring-primary/30"
                  />
                </div>
                <Select value={chipFilter} onValueChange={setChipFilter}>
                  <SelectTrigger className="w-40 h-9 text-sm bg-secondary/40 border-border/30">
                    <SelectValue placeholder="Chip" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os chips</SelectItem>
                    {chips.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nickname || c.phone_number || c.id.slice(0, 8)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={labelFilter} onValueChange={setLabelFilter}>
                  <SelectTrigger className="w-36 h-9 text-sm bg-secondary/40 border-border/30">
                    <SelectValue placeholder="Etiqueta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {labels.map(l => (
                      <SelectItem key={l.label_id} value={l.label_id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} className="h-9 border-border/30 hover:bg-secondary/60">
                  <Settings2 className="w-4 h-4 mr-1.5" />Colunas
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex gap-3 p-4 h-full">
                {columns.map(col => (
                  <KanbanColumn
                    key={col.id}
                    column={col}
                    cards={filteredByColumn[col.id] || []}
                    labels={labels}
                    onDrop={handleDrop}
                    onCardClick={setDetailCard}
                  />
                ))}
                {columns.length === 0 && (
                  <div className="flex flex-col items-center justify-center w-full text-muted-foreground gap-2">
                    <LayoutGrid className="w-10 h-10 opacity-30" />
                    <p className="text-sm">
                      Nenhuma coluna criada. {isAdmin ? 'Clique em "Colunas" para criar.' : 'Peça ao admin para configurar.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <KanbanCardDetailDialog
        card={detailCard}
        columns={columns}
        labels={labels}
        open={!!detailCard}
        onOpenChange={(o) => { if (!o) setDetailCard(null); }}
        onOpenChat={(chipId, remoteJid) => {
          onOpenChat(chipId, remoteJid);
          onOpenChange(false);
        }}
      />

      {isAdmin && (
        <KanbanSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          columns={columns}
          onCreateColumn={createColumn}
          onUpdateColumn={updateColumn}
          onDeleteColumn={deleteColumn}
          onReorderColumns={reorderColumns}
        />
      )}
    </>
  );
}
