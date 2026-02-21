import { cn } from '@/lib/utils';

interface LabelBadgeProps {
  name: string;
  colorHex?: string | null;
  className?: string;
  onClick?: () => void;
}

export default function LabelBadge({ name, colorHex, className, onClick }: LabelBadgeProps) {
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[80px]",
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      style={{
        backgroundColor: colorHex ? `${colorHex}20` : 'hsl(var(--muted))',
        color: colorHex || 'hsl(var(--muted-foreground))',
        borderLeft: `2px solid ${colorHex || 'hsl(var(--muted-foreground))'}`,
      }}
      title={name}
    >
      {name}
    </span>
  );
}
