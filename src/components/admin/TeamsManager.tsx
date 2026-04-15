import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Users, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface TeamMember {
  team_id: string;
  user_id: string;
}

interface UserOption {
  user_id: string;
  name: string | null;
  email: string;
}

interface TeamsManagerProps {
  users: UserOption[];
}

export function TeamsManager({ users }: TeamsManagerProps) {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchTeams(); }, []);

  const fetchTeams = async () => {
    setIsLoading(true);
    try {
      const [teamsRes, membersRes] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        supabase.from('team_members').select('team_id, user_id'),
      ]);
      if (teamsRes.error) throw teamsRes.error;
      setTeams(teamsRes.data || []);
      setMembers(membersRes.data || []);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreate = () => {
    setEditingTeam(null);
    setTeamName('');
    setTeamDescription('');
    setSelectedUserIds([]);
    setSearchQuery('');
    setDialogOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamDescription(team.description || '');
    setSelectedUserIds(members.filter(m => m.team_id === team.id).map(m => m.user_id));
    setSearchQuery('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!teamName.trim()) return;
    setIsSaving(true);
    try {
      let teamId: string;

      if (editingTeam) {
        const { error } = await supabase.from('teams')
          .update({ name: teamName.trim(), description: teamDescription.trim() || null } as any)
          .eq('id', editingTeam.id);
        if (error) throw error;
        teamId = editingTeam.id;

        // Remove old members and add new
        await supabase.from('team_members').delete().eq('team_id', teamId);
      } else {
        const { data, error } = await supabase.from('teams')
          .insert({ name: teamName.trim(), description: teamDescription.trim() || null } as any)
          .select('id')
          .single();
        if (error) throw error;
        teamId = data.id;
      }

      // Add members
      if (selectedUserIds.length > 0) {
        const rows = selectedUserIds.map(uid => ({ team_id: teamId, user_id: uid }));
        const { error: mError } = await supabase.from('team_members').insert(rows as any);
        if (mError) throw mError;
      }

      toast({ title: editingTeam ? 'Equipe atualizada' : 'Equipe criada' });
      setDialogOpen(false);
      fetchTeams();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (team: Team) => {
    if (!confirm(`Excluir equipe "${team.name}"?`)) return;
    try {
      const { error } = await supabase.from('teams').delete().eq('id', team.id);
      if (error) throw error;
      toast({ title: 'Equipe excluída' });
      fetchTeams();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const getUserLabel = (userId: string) => {
    const u = users.find(u => u.user_id === userId);
    return u?.name || u?.email || userId.slice(0, 8);
  };

  const getTeamMembers = (teamId: string) =>
    members.filter(m => m.team_id === teamId);

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return !q || (u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Equipes</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Equipes</CardTitle>
          <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Nova Equipe</Button>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma equipe criada ainda.</p>
          ) : (
            <div className="space-y-3">
              {teams.map(team => {
                const teamMembers = getTeamMembers(team.id);
                return (
                  <div key={team.id} className="flex items-start justify-between border rounded-lg p-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{team.name}</p>
                      {team.description && <p className="text-xs text-muted-foreground">{team.description}</p>}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {teamMembers.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Sem membros</span>
                        ) : (
                          teamMembers.map(m => (
                            <Badge key={m.user_id} variant="secondary" className="text-xs">
                              {getUserLabel(m.user_id)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(team)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(team)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Editar Equipe' : 'Nova Equipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Equipe</Label>
              <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Ex: Equipe Vendas SP" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={teamDescription} onChange={e => setTeamDescription(e.target.value)} placeholder="Ex: Equipe de vendas da região SP" />
            </div>
            <div className="space-y-2">
              <Label>Membros ({selectedUserIds.length})</Label>
              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selectedUserIds.map(uid => (
                    <Badge key={uid} variant="default" className="text-xs gap-1 cursor-pointer" onClick={() => toggleUser(uid)}>
                      {getUserLabel(uid)}
                      <X className="w-3 h-3" />
                    </Badge>
                  ))}
                </div>
              )}
              <Input
                placeholder="Buscar usuário..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className="max-h-40 overflow-y-auto border rounded-md">
                {filteredUsers.map(u => {
                  const isSelected = selectedUserIds.includes(u.user_id);
                  return (
                    <button
                      key={u.user_id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${isSelected ? 'bg-accent/50 font-medium' : ''}`}
                      onClick={() => toggleUser(u.user_id)}
                    >
                      {u.name || u.email}
                      {u.name && <span className="text-muted-foreground ml-1 text-xs">({u.email})</span>}
                    </button>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum usuário encontrado</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button disabled={isSaving || !teamName.trim()} onClick={handleSave}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTeam ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
