import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface JsonTreeViewProps {
  data: unknown;
  rootName?: string;
  defaultExpanded?: boolean;
  maxDepth?: number;
}

function ValueRenderer({ value }: { value: unknown }) {
  if (value === null) return <span className="text-orange-400 font-mono">null</span>;
  if (value === undefined) return <span className="text-muted-foreground font-mono">undefined</span>;
  if (typeof value === 'boolean') return <span className="text-emerald-400 font-mono">{value ? 'true' : 'false'}</span>;
  if (typeof value === 'number') return <span className="text-sky-400 font-mono">{value}</span>;
  if (typeof value === 'string') {
    // Truncate very long strings
    const display = value.length > 200 ? value.slice(0, 200) + '…' : value;
    return <span className="text-violet-400 font-mono">&quot;{display}&quot;</span>;
  }
  return <span className="text-muted-foreground font-mono">{String(value)}</span>;
}

function TreeNode({ keyName, value, depth, defaultExpanded, maxDepth }: {
  keyName: string | number | null;
  value: unknown;
  depth: number;
  defaultExpanded: boolean;
  maxDepth: number;
}) {
  const isExpandable = value !== null && typeof value === 'object';
  const [expanded, setExpanded] = useState(defaultExpanded && depth < maxDepth);

  if (!isExpandable) {
    return (
      <div className="flex items-start gap-1 py-0.5" style={{ paddingLeft: depth * 16 }}>
        {keyName !== null && (
          <span className="text-blue-300 font-mono text-xs shrink-0">&quot;{keyName}&quot;: </span>
        )}
        <ValueRenderer value={value} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray ? (value as unknown[]).map((v, i) => [i, v] as const) : Object.entries(value as Record<string, unknown>);
  const bracket = isArray ? ['[', ']'] : ['{', '}'];
  const itemCount = entries.length;

  return (
    <div>
      <div
        className="flex items-center gap-0.5 py-0.5 cursor-pointer hover:bg-muted/50 rounded-sm select-none"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        {keyName !== null && (
          <span className="text-blue-300 font-mono text-xs">&quot;{keyName}&quot;: </span>
        )}
        <span className="text-muted-foreground font-mono text-xs">
          {bracket[0]}
          {!expanded && <span className="text-muted-foreground/60"> {itemCount} {itemCount === 1 ? 'item' : 'itens'} </span>}
          {!expanded && bracket[1]}
        </span>
      </div>
      {expanded && (
        <>
          {entries.map(([k, v]) => (
            <TreeNode
              key={String(k)}
              keyName={k}
              value={v}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
              maxDepth={maxDepth}
            />
          ))}
          <div className="text-muted-foreground font-mono text-xs py-0.5" style={{ paddingLeft: depth * 16 }}>
            {bracket[1]}
          </div>
        </>
      )}
    </div>
  );
}

export function JsonTreeView({ data, rootName, defaultExpanded = true, maxDepth = 3 }: JsonTreeViewProps) {
  // Try to parse string data
  let parsed = data;
  if (typeof data === 'string') {
    try { parsed = JSON.parse(data); } catch { /* keep as string */ }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
    toast.success('JSON copiado');
  };

  return (
    <div className="relative group">
      <button
        onClick={handleCopy}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-muted hover:bg-muted/80"
        title="Copiar JSON"
      >
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      <div className="text-xs overflow-auto">
        <TreeNode
          keyName={rootName ?? null}
          value={parsed}
          depth={0}
          defaultExpanded={defaultExpanded}
          maxDepth={maxDepth}
        />
      </div>
    </div>
  );
}
