import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, Plus, Trash2, Eye, EyeOff, Pencil, Save, X } from 'lucide-react';
import { useHRAccessCredentials, type HRAccessCredential } from '@/hooks/useHRAccessCredentials';

interface Props {
  entityType: 'candidate' | 'employee';
  entityId: string;
}

export function AccessCredentialsTab({ entityType, entityId }: Props) {
  const { credentials, loading, create, update, remove } = useHRAccessCredentials(entityType, entityId);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ system_name: '', login: '', password: '', notes: '' });

  const handleAdd = async () => {
    if (!form.system_name.trim()) return;
    try {
      await create({ system_name: form.system_name.trim(), login: form.login, password: form.password, notes: form.notes || undefined });
      setForm({ system_name: '', login: '', password: '', notes: '' });
      setAdding(false);
    } catch { /* hook handles toast */ }
  };

  const handleUpdate = async (cred: HRAccessCredential) => {
    try {
      await update(cred.id, { system_name: form.system_name, login: form.login, password: form.password, notes: form.notes || null });
      setEditingId(null);
    } catch { /* hook handles toast */ }
  };

  const startEdit = (cred: HRAccessCredential) => {
    setEditingId(cred.id);
    setForm({ system_name: cred.system_name, login: cred.login, password: cred.password, notes: cred.notes || '' });
    setAdding(false);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{credentials.length} acesso{credentials.length !== 1 ? 's' : ''} cadastrado{credentials.length !== 1 ? 's' : ''}</p>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditingId(null); setForm({ system_name: '', login: '', password: '', notes: '' }); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Novo acesso
          </Button>
        )}
      </div>

      {adding && (
        <CredentialForm
          form={form}
          setForm={setForm}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
          saveLabel="Criar"
        />
      )}

      {credentials.map(cred => (
        editingId === cred.id ? (
          <CredentialForm
            key={cred.id}
            form={form}
            setForm={setForm}
            onSave={() => handleUpdate(cred)}
            onCancel={() => setEditingId(null)}
            saveLabel="Salvar"
          />
        ) : (
          <CredentialCard
            key={cred.id}
            credential={cred}
            onEdit={() => startEdit(cred)}
            onDelete={() => { if (confirm(`Remover acesso "${cred.system_name}"?`)) remove(cred.id); }}
          />
        )
      ))}

      {credentials.length === 0 && !adding && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Nenhum acesso cadastrado. Clique em "Novo acesso" para adicionar.
        </div>
      )}
    </div>
  );
}

function CredentialForm({ form, setForm, onSave, onCancel, saveLabel }: {
  form: { system_name: string; login: string; password: string; notes: string };
  setForm: (f: any) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  return (
    <Card className="p-3 space-y-2 border-primary/30">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Sistema *</Label>
          <Input value={form.system_name} onChange={e => setForm({ ...form, system_name: e.target.value })} placeholder="Ex: New Corban" className="h-8 text-sm" maxLength={100} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Login</Label>
          <Input value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} placeholder="usuario@email.com" className="h-8 text-sm" maxLength={200} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Senha</Label>
          <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••" className="h-8 text-sm" maxLength={200} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Observações</Label>
          <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Opcional..." className="h-8 text-sm" maxLength={500} />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 gap-1"><X className="w-3 h-3" /> Cancelar</Button>
        <Button size="sm" onClick={onSave} disabled={!form.system_name.trim()} className="h-7 gap-1"><Save className="w-3 h-3" /> {saveLabel}</Button>
      </div>
    </Card>
  );
}

function CredentialCard({ credential, onEdit, onDelete }: { credential: HRAccessCredential; onEdit: () => void; onDelete: () => void }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold truncate">{credential.system_name}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Login:</span> {credential.login || '—'}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium">Senha:</span>
            <span className="font-mono">{showPassword ? credential.password : '••••••••'}</span>
            <button onClick={() => setShowPassword(!showPassword)} className="hover:text-foreground transition-colors">
              {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
          {credential.notes && <p className="text-[11px] text-muted-foreground/70 truncate">{credential.notes}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}><Pencil className="w-3 h-3" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </div>
    </Card>
  );
}
