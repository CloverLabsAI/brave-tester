"use client";

interface CheckRowProps {
  name: string;
  passed: boolean;
  detail: string;
}

export function CheckRow({ name, passed, detail }: CheckRowProps) {
  return (
    <div className="flex items-start justify-between py-2 px-3.5 text-xs border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <span className="font-mono text-foreground">{name}</span>
        <p className="text-muted-foreground truncate mt-0.5">{detail}</p>
      </div>
      <span className={`ml-3 shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
        passed
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-destructive/10 text-destructive"
      }`}>
        {passed ? "PASS" : "FAIL"}
      </span>
    </div>
  );
}
