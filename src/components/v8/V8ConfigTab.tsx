import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function V8ConfigTab() {
  const [margin, setMargin] = useState<number>(5);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('v8_margin_config')
        .select('id, margin_percent')
        .limit(1)
        .maybeSingle();
      if (data) {
        setRowId(data.id);
        setMargin(Number(data.margin_percent));
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      if (rowId) {
        const { error } = await supabase
          .from('v8_margin_config')
          .update({ margin_percent: margin })
          .eq('id', rowId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('v8_margin_config')
          .insert({ margin_percent: margin });
        if (error) throw error;
      }
      toast.success('Margem salva');
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Configurações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Margem da empresa (%)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Percentual descontado do valor liberado para calcular o valor a cobrar do cliente.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
