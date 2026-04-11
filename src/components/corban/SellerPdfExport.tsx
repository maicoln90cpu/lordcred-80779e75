import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SellerPdfExportProps {
  sellerName: string;
  dateFrom: Date;
  dateTo: Date;
  analytics: {
    total: number;
    totalValor: number;
    ticketMedio: number;
    prazoMedio: number;
    taxaAprovacao: number;
    statusData: { name: string; value: number }[];
    bancoData: { name: string; value: number }[];
  };
  snapshots: {
    status: string | null;
    banco: string | null;
    valor_liberado: number | null;
    prazo: string | null;
    data_cadastro: string | null;
    nome: string | null;
    cpf: string | null;
  }[];
  resolveStatus: (key: string) => string;
}

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export function SellerPdfExport({ sellerName, dateFrom, dateTo, analytics, snapshots, resolveStatus }: SellerPdfExportProps) {
  const [generating, setGenerating] = useState(false);

  const handleExport = async () => {
    setGenerating(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório do Vendedor', margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Vendedor: ${sellerName}`, margin, y);
      y += 6;

      const periodoStr = `Período: ${format(dateFrom, 'dd/MM/yyyy', { locale: ptBR })} a ${format(dateTo, 'dd/MM/yyyy', { locale: ptBR })}`;
      doc.text(periodoStr, margin, y);
      y += 6;

      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
      doc.setTextColor(0, 0, 0);
      y += 10;

      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // KPIs section
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Indicadores', margin, y);
      y += 8;

      const kpis = [
        ['Total de Propostas', String(analytics.total)],
        ['Valor Total Liberado', fmtBRL(analytics.totalValor)],
        ['Ticket Médio', fmtBRL(analytics.ticketMedio)],
        ['Taxa de Aprovação', `${analytics.taxaAprovacao.toFixed(1)}%`],
        ['Prazo Médio', `${analytics.prazoMedio.toFixed(1)} meses`],
      ];

      (doc as any).autoTable({
        startY: y,
        head: [['Indicador', 'Valor']],
        body: kpis,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 10 },
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
        margin: { left: margin, right: margin },
        tableWidth: 'auto',
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Status breakdown
      if (analytics.statusData.length > 0) {
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Distribuição por Status', margin, y);
        y += 6;

        (doc as any).autoTable({
          startY: y,
          head: [['Status', 'Quantidade', '% do Total']],
          body: analytics.statusData.map(s => [
            s.name,
            String(s.value),
            `${((s.value / analytics.total) * 100).toFixed(1)}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 10 },
          bodyStyles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        });

        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Bank breakdown
      if (analytics.bancoData.length > 0) {
        if (y > 230) { doc.addPage(); y = 20; }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Distribuição por Banco', margin, y);
        y += 6;

        (doc as any).autoTable({
          startY: y,
          head: [['Banco', 'Quantidade', '% do Total']],
          body: analytics.bancoData.map(b => [
            b.name,
            String(b.value),
            `${((b.value / analytics.total) * 100).toFixed(1)}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 10 },
          bodyStyles: { fontSize: 9 },
          margin: { left: margin, right: margin },
        });

        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // Proposals detail table (last 50)
      const sortedSnaps = [...snapshots]
        .sort((a, b) => (b.data_cadastro || '').localeCompare(a.data_cadastro || ''))
        .slice(0, 50);

      if (sortedSnaps.length > 0) {
        if (y > 200) { doc.addPage(); y = 20; }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`Propostas Recentes (${Math.min(50, snapshots.length)} de ${snapshots.length})`, margin, y);
        y += 6;

        (doc as any).autoTable({
          startY: y,
          head: [['Nome', 'CPF', 'Banco', 'Status', 'Valor', 'Data']],
          body: sortedSnaps.map(s => [
            (s.nome || '-').substring(0, 25),
            s.cpf || '-',
            (s.banco || '-').substring(0, 15),
            resolveStatus(s.status || '-').substring(0, 20),
            s.valor_liberado ? fmtBRL(s.valor_liberado) : '-',
            s.data_cadastro ? s.data_cadastro.substring(0, 10) : '-',
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 28 },
            2: { cellWidth: 25 },
            3: { cellWidth: 30 },
            4: { cellWidth: 28 },
            5: { cellWidth: 22 },
          },
          margin: { left: margin, right: margin },
        });
      }

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(`LordCred — Relatório Vendedor — Página ${i}/${totalPages}`, margin, doc.internal.pageSize.getHeight() - 8);
      }

      const fileName = `relatorio_${sellerName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);
      toast.success('Relatório PDF gerado com sucesso!');
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error('Erro ao gerar PDF', { description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleExport} disabled={generating}>
      {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
      {generating ? 'Gerando...' : 'Exportar PDF'}
    </Button>
  );
}
