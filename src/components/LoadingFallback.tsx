import { Loader2 } from "lucide-react";

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando...</p>
    </div>
  </div>
);

export default LoadingFallback;
