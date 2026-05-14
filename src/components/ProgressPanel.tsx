"use client";

import type { ProfileResult } from "@/lib/types";

interface ProgressPanelProps {
  currentProfile: string | null;
  currentIndex: number;
  totalProfiles: number;
  completedProfiles: ProfileResult[];
}

export function ProgressPanel({ currentProfile, totalProfiles, completedProfiles }: ProgressPanelProps) {
  const progress = totalProfiles > 0 ? (completedProfiles.length / totalProfiles) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Running tests</h2>
        <p className="text-sm text-muted-foreground">
          {completedProfiles.length} of {totalProfiles} profiles complete
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-5">
        {currentProfile && (
          <p className="text-sm text-foreground animate-pulse">{currentProfile}</p>
        )}

        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-[#FB542B] rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: totalProfiles }).map((_, i) => {
            const completed = completedProfiles[i];
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs border transition-colors ${
                  completed
                    ? completed.error
                      ? "border-destructive/30 text-destructive"
                      : "border-emerald-500/30 text-emerald-400"
                    : "border-border text-muted-foreground"
                }`}
              >
                <span className="font-mono">
                  {completed ? (completed.error ? "✗" : "✓") : "○"}
                </span>
                <span className="truncate">
                  {completed?.profile?.name || `Profile ${String.fromCharCode(65 + i)}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
