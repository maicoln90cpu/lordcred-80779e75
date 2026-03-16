import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Loader2, FileSpreadsheet, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

interface ParsedLead {
  data_ref: string;
  banco_simulado: string;
  nome: string;
  telefone: string;
  cpf: string;
  valor_lib: number | null;
  prazo: number | null;
  vlr_parcela: number | null;
  status: string;
  aprovado: string;
  reprovado: string;
  data_nasc: string;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  conta: string;
  nome_mae: string;
}

function cleanCurrency(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null;
  const str = String(value).replace(/[R$\s.]/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function cleanPhone(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

interface ProfileOption {
  value: string;
  label: string;
  color_class: string;
}

export default function LeadImporter() {
  const [parsedData, setParsedData] = useState<ParsedLead[]>([]);
  const [batchName, setBatchName] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [fileName, setFileName] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: sellers = [] } = useQuery({
    queryKey: ['sellers-for-leads'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (!roles) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);
      return (profiles || []).map(p => {
        const role = roles.find(r => r.user_id === p.user_id);
        return { user_id: p.user_id, name: p.name || p.email, email: p.email, role: role?.role || 'user' };
      });
    }
  });

  const { data: profileOptions = [] } = useQuery({
    queryKey: ['lead-profile-options'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('lead_profile_options')
        .maybeSingle();
      if (data?.lead_profile_options && Array.isArray(data.lead_profile_options)) {
        return data.lead_profile_options as unknown as ProfileOption[];
      }
      return [];
    }
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImported(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      const parsed: ParsedLead[] = rows.map(row => ({
        data_ref: String(row['DATA'] || ''),
        banco_simulado: String(row['BANCO SIMULADO'] || ''),
        nome: String(row['NOME'] || ''),
        telefone: cleanPhone(row['TELEFONE']),
        cpf: String(row['CPF'] || ''),
        valor_lib: cleanCurrency(row['VALOR LIB']),
        prazo: row['PRAZO'] ? parseInt(String(row['PRAZO'])) : null,
        vlr_parcela: cleanCurrency(row['VLR PARCELA']),
        status: String(row['STATUS'] || 'pendente'),
        aprovado: String(row['APROVADO'] || ''),
        reprovado: String(row['REPROVADO'] || ''),
        data_nasc: String(row['DATA NASC'] || ''),
        banco_codigo: String(row['BANCO'] || ''),
        banco_nome: String(row['BANCO_NOME'] || ''),
        agencia: String(row['AGENCIA'] || ''),
        conta: String(row['CONTA'] || ''),
        nome_mae: String(row['NOME_MAE'] || ''),
      }));

      setParsedData(parsed.filter(p => p.nome.trim() !== ''));
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleImport = async () => {
    if (!selectedSeller || parsedData.length === 0) {
      toast({ title: 'Selecione um vendedor e carregue uma planilha', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    try {
      const batch = parsedData.map(lead => ({
        created_by: user!.id,
        assigned_to: selectedSeller,
        batch_name: batchName || fileName,
        perfil: selectedProfile || null,
        data_ref: lead.data_ref,
        banco_simulado: lead.banco_simulado,
        nome: lead.nome,
        telefone: lead.telefone,
        cpf: lead.cpf,
        valor_lib: lead.valor_lib,
        prazo: lead.prazo,
        vlr_parcela: lead.vlr_parcela,
        status: lead.status || 'pendente',
        aprovado: lead.aprovado,
        reprovado: lead.reprovado,
        data_nasc: lead.data_nasc,
        banco_codigo: lead.banco_codigo,
        banco_nome: lead.banco_nome,
        agencia: lead.agencia,
        conta: lead.conta,
        nome_mae: lead.nome_mae,
      }));

      for (let i = 0; i < batch.length; i += 100) {
        const chunk = batch.slice(i, i + 100);
        const { error } = await supabase.from('client_leads' as any).insert(chunk as any);
        if (error) throw error;
      }

      toast({ title: `${parsedData.length} leads importados com sucesso!` });
      setImported(true);
      setParsedData([]);
      setFileName('');
    } catch (error: any) {
      toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Planilha de Leads
          </CardTitle>
          <CardDescription>
            Carregue um arquivo XLSX com os dados dos clientes e atribua a um vendedor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Arquivo XLSX</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              {fileName && (
                <p className="text-sm text-muted-foreground">📄 {fileName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nome do Lote (opcional)</Label>
              <Input
                placeholder="Ex: Fev 2026 - V8"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Atribuir ao Vendedor</Label>
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.name} <span className="text-muted-foreground text-xs ml-1">({s.role})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Perfil dos Leads (opcional)</Label>
              <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem perfil</SelectItem>
                  {profileOptions.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {parsedData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{parsedData.length} leads encontrados</Badge>
                <Button onClick={handleImport} disabled={isImporting || !selectedSeller}>
                  {isImporting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> Importar Leads</>
                  )}
                </Button>
              </div>

              <div className="border rounded-lg max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Valor Lib.</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Banco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 50).map((lead, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{lead.nome}</TableCell>
                        <TableCell>{lead.telefone}</TableCell>
                        <TableCell>{lead.cpf}</TableCell>
                        <TableCell>{lead.valor_lib?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}</TableCell>
                        <TableCell>{lead.prazo || '-'}</TableCell>
                        <TableCell>{lead.vlr_parcela?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={lead.status === 'CHAMEI' ? 'default' : 'secondary'}>
                            {lead.status || 'pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell>{lead.banco_nome}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    Mostrando 50 de {parsedData.length} leads...
                  </p>
                )}
              </div>
            </div>
          )}

          {imported && (
            <div className="flex items-center gap-2 text-green-500">
              <Check className="w-5 h-5" />
              <span>Leads importados com sucesso!</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
