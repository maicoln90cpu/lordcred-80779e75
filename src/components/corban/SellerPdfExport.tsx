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

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#a855f7',
];

function drawBarChart(
  data: { name: string; value: number }[],
  title: string,
  width: number,
  height: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2; // 2x for retina
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  const padding = { top: 40, right: 20, bottom: 60, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 24);

  if (data.length === 0) return canvas.toDataURL('image/png');

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.min(40, (chartW / data.length) * 0.6);
  const gap = (chartW - barWidth * data.length) / (data.length + 1);

  // Y-axis grid lines
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 0.5;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const yVal = (maxVal / 4) * i;
    const yPos = padding.top + chartH - (chartH * (yVal / maxVal));
    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(width - padding.right, yPos);
    ctx.stroke();
    ctx.fillText(String(Math.round(yVal)), padding.left - 6, yPos + 3);
  }

  // Bars
  data.forEach((d, i) => {
    const barH = (d.value / maxVal) * chartH;
    const x = padding.left + gap + i * (barWidth + gap);
    const y = padding.top + chartH - barH;

    // Bar
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
    ctx.fill();

    // Value on top
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(d.value), x + barWidth / 2, y - 4);

    // Label below
    ctx.fillStyle = '#64748b';
    ctx.font = '8px sans-serif';
    ctx.save();
    ctx.translate(x + barWidth / 2, padding.top + chartH + 8);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = 'right';
    const label = d.name.length > 18 ? d.name.substring(0, 16) + '…' : d.name;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

function drawPieChart(
  data: { name: string; value: number }[],
  title: string,
  width: number,
  height: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 24);

  if (data.length === 0) return canvas.toDataURL('image/png');

  const total = data.reduce((s, d) => s + d.value, 0);
  const centerX = width * 0.35;
  const centerY = height / 2 + 10;
  const radius = Math.min(centerX - 20, centerY - 40);

  let startAngle = -Math.PI / 2;

  data.forEach((d, i) => {
    const sliceAngle = (d.value / total) * Math.PI * 2;

    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();

    // Thin white border between slices
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle += sliceAngle;
  });

  // Legend on the right
  const legendX = width * 0.62;
  let legendY = 44;
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';

  data.forEach((d, i) => {
    if (legendY > height - 10) return;
    const pct = ((d.value / total) * 100).toFixed(1);

    // Color box
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(legendX, legendY - 7, 10, 10);

    // Label
    ctx.fillStyle = '#1e293b';
    const label = d.name.length > 16 ? d.name.substring(0, 14) + '…' : d.name;
    ctx.fillText(`${label} (${pct}%)`, legendX + 14, legendY + 2);

    legendY += 16;
  });

  return canvas.toDataURL('image/png');
}

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

      // ===== CHARTS SECTION =====
      const chartWidth = 360;
      const chartHeight = 200;
      const chartMmWidth = pageWidth - margin * 2;
      const chartMmHeight = (chartMmWidth / chartWidth) * chartHeight;

      // Bar chart — Status distribution
      if (analytics.statusData.length > 0) {
        if (y + chartMmHeight + 10 > 270) { doc.addPage(); y = 20; }

        const barImg = drawBarChart(
          analytics.statusData.slice(0, 10),
          'Distribuição por Status',
          chartWidth,
          chartHeight,
        );
        doc.addImage(barImg, 'PNG', margin, y, chartMmWidth, chartMmHeight);
        y += chartMmHeight + 8;
      }

      // Pie chart — Bank distribution
      if (analytics.bancoData.length > 0) {
        if (y + chartMmHeight + 10 > 270) { doc.addPage(); y = 20; }

        const pieImg = drawPieChart(
          analytics.bancoData.slice(0, 10),
          'Distribuição por Banco',
          chartWidth,
          chartHeight,
        );
        doc.addImage(pieImg, 'PNG', margin, y, chartMmWidth, chartMmHeight);
        y += chartMmHeight + 8;
      }

      // Status breakdown table
      if (analytics.statusData.length > 0) {
        if (y + 30 > 270) { doc.addPage(); y = 20; }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalhamento por Status', margin, y);
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

      // Bank breakdown table
      if (analytics.bancoData.length > 0) {
        if (y + 30 > 270) { doc.addPage(); y = 20; }

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalhamento por Banco', margin, y);
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
