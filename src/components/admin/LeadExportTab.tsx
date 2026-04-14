import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function LeadExportTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  const fetchAllLeads = async () => {
    const allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase.from('client_leads').select('*').range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return allData;
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const data = await fetchAllLeads();
      if (data.length === 0) { toast({ title: 'Nenhum lead para exportar' }); setIsExporting(false); return; }
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(','), ...data.map(row => headers.map(h => { const v = row[h]; if (v == null) return ''; return `"${String(v).replace(/"/g, '""')}"`; }).join(','))];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `leads_backup_${new Date().toISOString().split('T')[0]}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportado!', description: `${data.length} leads exportados em CSV` });
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    setIsExporting(false);
  };

  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const data = await fetchAllLeads();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `leads_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportado!', description: `${data.length} leads exportados em JSON` });
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
    setIsExporting(false);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsExporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as any[];
      if (!Array.isArray(data)) throw new Error('Formato inválido');
      const cleaned = data.map(({ id, created_at, updated_at, ...rest }) => rest);
      let inserted = 0;
      for (let i = 0; i < cleaned.length; i += 100) {
        const batch = cleaned.slice(i, i + 100);
        const { error } = await supabase.from('client_leads').insert(batch as any);
        if (error) throw error;
        inserted += batch.length;
      }
      toast({ title: 'Importado!', description: `${inserted} leads restaurados` });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads-metrics'] });
    } catch (err: any) { toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' }); }
    setIsExporting(false);
    e.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" />Backup e Exportação de Leads</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Button onClick={handleExportCSV} disabled={isExporting} variant="outline" className="h-20 flex-col gap-2"><FileSpreadsheet className="w-6 h-6" /><span>Exportar CSV</span></Button>
          <Button onClick={handleExportJSON} disabled={isExporting} variant="outline" className="h-20 flex-col gap-2"><FileJson className="w-6 h-6" /><span>Exportar JSON</span></Button>
          <label className="cursor-pointer">
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            <div className="h-20 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border hover:bg-secondary/30 transition-colors"><Upload className="w-6 h-6" /><span className="text-sm">Restaurar JSON</span></div>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">O backup JSON pode ser restaurado posteriormente. O CSV é compatível com planilhas.</p>
      </CardContent>
    </Card>
  );
}
