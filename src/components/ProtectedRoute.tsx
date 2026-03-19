import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireMaster?: boolean;
  blockSellers?: boolean;
  blockSupport?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false, requireMaster = false, blockSellers = false, blockSupport = false }: ProtectedRouteProps) {
  const { user, isMaster, isAdmin, isSeller, isSupport, isLoading, isBlocked } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Acesso Bloqueado</h1>
          <p className="text-muted-foreground">Sua conta foi bloqueada. Entre em contato com o administrador.</p>
        </div>
      </div>
    );
  }

  if (blockSellers && isSeller) {
    return <Navigate to="/whatsapp" replace />;
  }

  if (blockSupport && isSupport) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/whatsapp" replace />;
  }

  return <>{children}</>;
}
