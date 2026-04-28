import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * Badge que faz uma "pulsação" curta sempre que o `value` numérico muda.
 * Usado no header de cada lote no Histórico V8 para chamar a atenção quando
 * `success_count` ou `failure_count` é incrementado em tempo real.
 */
export function AnimatedCountBadge({
  value,
  variant = 'outline',
  pulseClass = 'bg-emerald-500/20',
  children,
}: {
  value: number;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  pulseClass?: string;
  children: React.ReactNode;
}) {
  const prevRef = useRef(value);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setPulsing(true);
      const id = setTimeout(() => setPulsing(false), 900);
      return () => clearTimeout(id);
    }
  }, [value]);

  return (
    <Badge
      variant={variant}
      className={`transition-all duration-300 ${pulsing ? `scale-110 ${pulseClass}` : ''}`}
    >
      {children}
    </Badge>
  );
}
