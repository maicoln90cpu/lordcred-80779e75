import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Settings, Loader2, Save, BarChart3, RefreshCw } from 'lucide-react';
import { fmtBRL, DAY_NAMES } from './commissionUtils';
import type { Profile, BonusTier, AnnualReward } from './commissionUtils';

interface ConfigTabProps {
  profiles: Profile[];
  getSellerName: (id: string) => string;
}

export default function ConfigTab({ profiles, getSellerName }: ConfigTabProps) {
  const { toast } = useToast();
  const [weekStartDay, setWeekStartDay] = useState<number>(5);
  const [paymentDay, setPaymentDay] = useState<number>(4);
  const [bonusThreshold, setBonusThreshold] = useState<string>('');
  const [bonusRate, setBonusRate] = useState<string>('0');
  const [bonusMode, setBonusMode] = useState<string>('valor');
  const [bonusFixedValue, setBonusFixedValue] = useState<string>('0');
  const [monthlyGoalValue, setMonthlyGoalValue] = useState<string>('0');
  const [monthlyGoalType, setMonthlyGoalType] = useState<string>('contratos');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tiers, setTiers] = useState<BonusTier[]>([]);
  const [tierForm, setTierForm] = useState({ min_contracts: '', bonus_value: '' });
  const [editingTier, setEditingTier] = useState<BonusTier | null>(null);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);

  useEffect(() => { loadSettings(); loadTiers(); }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from('commission_settings_v2').select('*').limit(1).single();
    if (data) {
      setWeekStartDay((data as any).week_start_day ?? 5);
      setPaymentDay((data as any).payment_day ?? 4);
      setBonusThreshold((data as any).bonus_threshold != null ? String((data as any).bonus_threshold) : '');
      setBonusRate(String((data as any).bonus_rate ?? 0));
      setBonusMode((data as any).bonus_mode ?? 'valor');
      setBonusFixedValue(String((data as any).bonus_fixed_value ?? 0));
      setMonthlyGoalValue(String((data as any).monthly_goal_value ?? 0));
      setMonthlyGoalType((data as any).monthly_goal_type ?? 'contratos');
    }
    setLoading(false);
  };

  const loadTiers = async () => {
    const { data } = await supabase.from('commission_bonus_tiers_v2' as any).select('*').order('min_contracts', { ascending: true });
    if (data) setTiers(data as any as BonusTier[]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase.from('commission_settings_v2').select('id').limit(1).single();
      if (existing) {
        const { error } = await supabase.from('commission_settings_v2').update({
          week_start_day: weekStartDay, payment_day: paymentDay,
          bonus_threshold: bonusThreshold ? parseFloat(bonusThreshold) : null,
          bonus_rate: parseFloat(bonusRate) || 0, bonus_mode: bonusMode,
          bonus_fixed_value: parseFloat(bonusFixedValue) || 0,
          monthly_goal_value: parseFloat(monthlyGoalValue) || 0,
          monthly_goal_type: monthlyGoalType,
          updated_at: new Date().toISOString(),
        } as any).eq('id', existing.id);
        if (error) throw error;
      }
      toast({ title: 'Configurações salvas' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleSaveTier = async () => {
    const minC = parseInt(tierForm.min_contracts);
    const bonusV = parseFloat(tierForm.bonus_value);
    if (!minC || !bonusV) { toast({ title: 'Preencha contratos e valor', variant: 'destructive' }); return; }
    let error;
    if (editingTier) {
      ({ error } = await supabase.from('commission_bonus_tiers_v2' as any).update({ min_contracts: minC, bonus_value: bonusV } as any).eq('id', editingTier.id));
    } else {
      ({ error } = await supabase.from('commission_bonus_tiers_v2' as any).insert({ min_contracts: minC, bonus_value: bonusV } as any));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Faixa salva' }); setTierDialogOpen(false); loadTiers(); }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Excluir esta faixa?')) return;
    await supabase.from('commission_bonus_tiers_v2' as any).delete().eq('id', id);
    toast({ title: 'Faixa excluída' }); loadTiers();
  };

  if (loading) return <p className="text-center text-muted-foreground py-8">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Configurações e Bônus</CardTitle>
          <p className="text-sm text-muted-foreground">Regras semanais, premiação e faixas escalonadas de bônus mensal.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4 max-w-sm">
              <h3 className="font-medium text-sm border-b pb-2">Regras Semanais</h3>
              <div className="space-y-2">
                <Label>Dia de início da semana</Label>
                <Select value={String(weekStartDay)} onValueChange={v => setWeekStartDay(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAY_NAMES.map((name, i) => <SelectItem key={i} value={String(i)}>{name}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Atualmente: <strong>{DAY_NAMES[weekStartDay]}</strong></p>
              </div>
              <div className="space-y-2">
                <Label>Dia de pagamento (referência)</Label>
                <Select value={String(paymentDay)} onValueChange={v => setPaymentDay(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAY_NAMES.map((name, i) => <SelectItem key={i} value={String(i)}>{name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-4 max-w-sm">
              <h3 className="font-medium text-sm border-b pb-2">Bônus Simples (por semana)</h3>
              <div className="space-y-2">
                <Label>Tipo de meta</Label>
                <Select value={bonusMode} onValueChange={setBonusMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valor">Valor Liberado (R$)</SelectItem>
                    <SelectItem value="contratos">Nº de Contratos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{bonusMode === 'valor' ? 'Meta semanal (R$)' : 'Nº mínimo de contratos'}</Label>
                <Input type="number" step={bonusMode === 'valor' ? '0.01' : '1'}
                  placeholder={bonusMode === 'valor' ? 'Ex: 50000' : 'Ex: 8'}
                  value={bonusThreshold} onChange={e => setBonusThreshold(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bônus fixo por contrato (R$)</Label>
                <Input type="number" step="0.01" value={bonusFixedValue} onChange={e => setBonusFixedValue(e.target.value)} placeholder="Ex: 50" />
              </div>
              <div className="space-y-2">
                <Label>Bônus variável (%)</Label>
                <Input type="number" step="0.01" value={bonusRate} onChange={e => setBonusRate(e.target.value)} placeholder="Ex: 2" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium text-sm border-b pb-2 mb-4">📊 Meta Mensal Global</h3>
            <div className="grid gap-4 md:grid-cols-2 max-w-lg">
              <div className="space-y-2">
                <Label>Tipo de meta mensal</Label>
                <Select value={monthlyGoalType} onValueChange={setMonthlyGoalType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contratos">Nº de Contratos</SelectItem>
                    <SelectItem value="valor">Valor Liberado (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{monthlyGoalType === 'contratos' ? 'Meta de contratos/mês' : 'Meta de valor/mês (R$)'}</Label>
                <Input type="number" step={monthlyGoalType === 'valor' ? '0.01' : '1'}
                  value={monthlyGoalValue} onChange={e => setMonthlyGoalValue(e.target.value)} />
                <p className="text-xs text-muted-foreground">Deixe 0 para desativar.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-start gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Configurações
            </Button>
            <RecalcAllV2Button />
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Faixas de Bônus por Produção (Mensal)</h3>
                <p className="text-xs text-muted-foreground mt-1">Faixas escalonadas — vendedor recebe o bônus da faixa mais alta atingida.</p>
              </div>
              <Button size="sm" onClick={() => { setEditingTier(null); setTierForm({ min_contracts: '', bonus_value: '' }); setTierDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Faixa
              </Button>
            </div>
            {tiers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Nenhuma faixa cadastrada</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nº Mínimo de Contratos</TableHead>
                  <TableHead className="text-right">Valor do Bônus (R$)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {tiers.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.min_contracts} contratos</TableCell>
                      <TableCell className="text-right font-bold text-primary">{fmtBRL(t.bonus_value)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTier(t); setTierForm({ min_contracts: String(t.min_contracts), bonus_value: String(t.bonus_value) }); setTierDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTier(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>{editingTier ? 'Editar Faixa' : 'Nova Faixa de Bônus'}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Nº mínimo de contratos</Label><Input type="number" value={tierForm.min_contracts} onChange={e => setTierForm({ ...tierForm, min_contracts: e.target.value })} placeholder="Ex: 10" /></div>
                  <div><Label>Valor do bônus (R$)</Label><Input type="number" step="0.01" value={tierForm.bonus_value} onChange={e => setTierForm({ ...tierForm, bonus_value: e.target.value })} placeholder="Ex: 200" /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTierDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSaveTier}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border-t pt-6"><AnnualRewardsSection /></div>
          <div className="border-t pt-6"><AnnualProgressSection profiles={profiles} getSellerName={getSellerName} /></div>
          <div className="border-t pt-6"><DangerZoneSection /></div>
        </CardContent>
      </Card>
    </div>
  );
}

function RecalcAllV2Button() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const handleClick = async () => {
    if (!confirm('Recalcular todas as vendas V2?\n\nIsso reaplica taxas e bônus em TODA a base V2 (pode levar alguns segundos).')) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.rpc('recalculate_commissions_v2' as any);
      if (error) throw error;
      const n = (data as any)?.recalculated ?? 0;
      toast({ title: '🔄 Recalculado', description: `${n} venda(s) reprocessada(s).` });
    } catch (err: any) {
      toast({ title: 'Erro ao recalcular', description: err.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };
  return (
    <Button variant="outline" onClick={handleClick} disabled={running}>
      {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
      Recalcular Vendas V2
    </Button>
  );
}

function AnnualRewardsSection() {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<AnnualReward[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AnnualReward | null>(null);
  const [form, setForm] = useState({ min_contracts: '', reward_description: '' });

  useEffect(() => { loadRewards(); }, []);

  const loadRewards = async () => {
    const { data } = await supabase.from('commission_annual_rewards_v2' as any).select('*').order('sort_order', { ascending: true });
    if (data) setRewards(data as any as AnnualReward[]);
  };

  const handleSave = async () => {
    const minC = parseInt(form.min_contracts);
    if (!minC || !form.reward_description.trim()) { toast({ title: 'Preencha todos os campos', variant: 'destructive' }); return; }
    let error;
    if (editing) {
      ({ error } = await supabase.from('commission_annual_rewards_v2' as any).update({ min_contracts: minC, reward_description: form.reward_description.trim() } as any).eq('id', editing.id));
    } else {
      const nextOrder = rewards.length > 0 ? Math.max(...rewards.map(r => r.sort_order)) + 1 : 1;
      ({ error } = await supabase.from('commission_annual_rewards_v2' as any).insert({ min_contracts: minC, reward_description: form.reward_description.trim(), sort_order: nextOrder } as any));
    }
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Premiação salva' }); setDialogOpen(false); loadRewards(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta premiação?')) return;
    await supabase.from('commission_annual_rewards_v2' as any).delete().eq('id', id);
    toast({ title: 'Premiação excluída' }); loadRewards();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium text-sm flex items-center gap-2">🏆 Premiações Anuais por Acúmulo</h3>
          <p className="text-xs text-muted-foreground mt-1">Metas acumuladas no ano — prêmios especiais para alta produção.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ min_contracts: '', reward_description: '' }); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Premiação</Button>
      </div>
      {rewards.length === 0 ? (
        <p className="text-center text-muted-foreground py-4">Nenhuma premiação cadastrada</p>
      ) : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Contratos no Ano</TableHead>
            <TableHead>Premiação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rewards.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.min_contracts} contratos</TableCell>
                <TableCell>{r.reward_description}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(r); setForm({ min_contracts: String(r.min_contracts), reward_description: r.reward_description }); setDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Editar Premiação' : 'Nova Premiação Anual'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nº mínimo de contratos no ano</Label><Input type="number" value={form.min_contracts} onChange={e => setForm({ ...form, min_contracts: e.target.value })} placeholder="Ex: 250" /></div>
            <div><Label>Descrição da premiação</Label><Input value={form.reward_description} onChange={e => setForm({ ...form, reward_description: e.target.value })} placeholder="Ex: Final de semana em hotel" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AnnualProgressSection({ profiles, getSellerName }: { profiles: Profile[]; getSellerName: (id: string) => string }) {
  const [rewards, setRewards] = useState<AnnualReward[]>([]);
  const [sellerCounts, setSellerCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const year = new Date().getFullYear();
    const [rewardsRes, salesRes] = await Promise.all([
      supabase.from('commission_annual_rewards_v2' as any).select('*').order('sort_order', { ascending: true }),
      supabase.from('commission_sales_v2').select('seller_id, id').gte('sale_date', `${year}-01-01T00:00:00`).lte('sale_date', `${year}-12-31T23:59:59`),
    ]);
    if (rewardsRes.data) setRewards(rewardsRes.data as any as AnnualReward[]);
    if (salesRes.data) {
      const counts = new Map<string, number>();
      for (const s of salesRes.data) counts.set(s.seller_id, (counts.get(s.seller_id) || 0) + 1);
      setSellerCounts(counts);
    }
    setLoading(false);
  };

  const sellerProgress = useMemo(() => {
    if (rewards.length === 0) return [];
    const sortedRewards = [...rewards].sort((a, b) => a.min_contracts - b.min_contracts);
    return profiles.map(p => {
      const count = sellerCounts.get(p.user_id) || 0;
      const nextReward = sortedRewards.find(r => r.min_contracts > count);
      const currentReward = [...sortedRewards].reverse().find(r => r.min_contracts <= count);
      const nextTarget = nextReward?.min_contracts || (sortedRewards[sortedRewards.length - 1]?.min_contracts || 0);
      const remaining = nextReward ? nextReward.min_contracts - count : 0;
      const pct = nextTarget > 0 ? Math.min((count / nextTarget) * 100, 100) : 100;
      return { userId: p.user_id, name: p.name || p.email, count, nextReward: nextReward?.reward_description || '🎉 Todas atingidas!', currentReward: currentReward?.reward_description || null, remaining, pct };
    }).filter(p => p.count > 0 || sellerCounts.size === 0).sort((a, b) => b.count - a.count);
  }, [profiles, sellerCounts, rewards]);

  if (loading) return <p className="text-center text-muted-foreground py-4 text-sm">Carregando progresso...</p>;
  if (rewards.length === 0) return <p className="text-center text-muted-foreground py-4 text-sm">Cadastre premiações anuais acima para ver o progresso.</p>;

  return (
    <>
      <div className="mb-3">
        <h3 className="font-medium text-sm flex items-center gap-2">📈 Progresso Anual dos Vendedores ({new Date().getFullYear()})</h3>
        <p className="text-xs text-muted-foreground mt-1">Contratos acumulados no ano vs próxima premiação.</p>
      </div>
      {sellerProgress.length === 0 ? (
        <p className="text-center text-muted-foreground py-4 text-sm">Nenhuma venda registrada no ano.</p>
      ) : (
        <div className="space-y-3">
          {sellerProgress.map(sp => (
            <div key={sp.userId} className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium">{sp.name}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{sp.count} contratos</Badge>
                  {sp.currentReward && <Badge variant="secondary" className="text-[10px]">✅ {sp.currentReward}</Badge>}
                </div>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${sp.pct >= 100 ? 'bg-green-500' : sp.pct >= 70 ? 'bg-primary' : sp.pct >= 40 ? 'bg-yellow-500' : 'bg-orange-400'}`}
                  style={{ width: `${sp.pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {sp.remaining > 0 ? `Faltam ${sp.remaining} para: ${sp.nextReward}` : sp.nextReward}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Zona de Perigo: ações destrutivas isoladas em uma seção visualmente alarmante,
 * com confirmação por digitação ("CONFIRMAR"). Movido do header da BaseTab para
 * reduzir clique acidental por privilegiados.
 */
function DangerZoneSection() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleClearAllSales = async () => {
    setBusy(true);
    try {
      const { count } = await supabase
        .from('commission_sales_v2')
        .select('*', { count: 'exact', head: true });
      if (!count || count === 0) {
        toast({ title: 'Nenhuma venda para apagar' });
        return;
      }
      const typed = window.prompt(
        `ATENÇÃO: você está prestes a APAGAR todas as ${count} venda(s) do módulo Comissões Parceiros.\n\nEsta ação NÃO pode ser desfeita.\n\nPara prosseguir, digite a palavra CONFIRMAR (em maiúsculas):`
      );
      if (typed !== 'CONFIRMAR') {
        toast({ title: 'Cancelado', description: 'Texto não confere — nada foi apagado.' });
        return;
      }
      const { error } = await supabase
        .from('commission_sales_v2')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        toast({ title: 'Erro ao limpar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: '🗑️ Vendas removidas', description: `${count} venda(s) apagada(s).` });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <h3 className="font-semibold text-sm text-destructive flex items-center gap-2">
        ⚠️ Zona de Perigo
      </h3>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        Ações destrutivas e irreversíveis. Use com cuidado — exigem confirmação por texto.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-destructive/30 bg-background p-3">
        <div className="text-sm">
          <p className="font-medium">Limpar todas as vendas</p>
          <p className="text-xs text-muted-foreground">Remove TODOS os registros de comissões parceiros (V2).</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAllSales}
          disabled={busy}
          className="border-destructive/60 hover:bg-destructive/10 text-destructive"
        >
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
          Limpar todas as vendas
        </Button>
      </div>
    </div>
  );
}
