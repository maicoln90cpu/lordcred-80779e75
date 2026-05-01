import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useFeaturePermissions } from "@/hooks/useFeaturePermissions";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireMaster?: boolean;
  blockSellers?: boolean;
  blockSupport?: boolean;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireMaster = false,
  blockSellers = false,
  blockSupport = false,
}: ProtectedRouteProps) {
  const { user, isMaster, isAdmin, isManager, isSeller, isSupport, isLoading, isBlocked } = useAuth();
  const { hasRoutePermission, loading: permLoading } = useFeaturePermissions();
  const location = useLocation();

  if (isLoading || permLoading) {
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

  if (requireMaster && !isMaster) {
    return <Navigate to="/whatsapp" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/whatsapp" replace />;
  }

  // Block manager from permissions page specifically
  if (isManager && location.pathname === "/admin/permissions") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Acesso Restrito</h1>
          <p className="text-muted-foreground">Administrador podem gerenciar permissões.</p>
        </div>
      </div>
    );
  }

  // Feature permission enforcement
  if (!hasRoutePermission(location.pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta funcionalidade.</p>
          <p className="text-sm text-muted-foreground mt-1">Solicite acesso ao administrador.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
