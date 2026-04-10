import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ContractTemplateEditor } from '@/components/partners/ContractTemplateEditor';

export default function ContractTemplate() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/parceiros')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Template do Contrato</h1>
            <p className="text-sm text-muted-foreground">
              Modelo base utilizado para gerar contratos de todos os parceiros
            </p>
          </div>
        </div>
        <ContractTemplateEditor />
      </div>
    </DashboardLayout>
  );
}
