"use client";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CheckRow } from "./CheckRow";

const CATEGORY_LABELS: Record<string, string> = {
  automation: "Automation Detection",
  chromiumAPIs: "Chromium APIs",
  lieDetection: "Lie / Tampering Detection",
  crossSignal: "Cross-Signal Consistency",
  cssFingerprint: "CSS Fingerprint",
  mathEngine: "Math Engine",
  permissionsAPI: "Permissions API",
  speechVoices: "Speech Voices",
  performanceAPI: "Performance API",
  intlConsistency: "Intl Consistency",
  emojiFingerprint: "Emoji Fingerprint",
  canvasNoiseDetection: "Canvas Noise",
  webglRenderHash: "WebGL Render",
  fontPlatformConsistency: "Font Platform",
  audioIntegrity: "Audio Integrity",
  iframeTesting: "Iframe Testing",
  workerConsistency: "Worker Consistency",
  headlessDetection: "Headless Detection",
  trashDetection: "Trash Detection",
  fontEnvironment: "Font Environment",
};

interface CheckCategoryProps {
  category: string;
  checks: Record<string, { passed: boolean; detail: string }>;
  defaultOpen?: boolean;
}

export function CheckCategory({ category, checks, defaultOpen = false }: CheckCategoryProps) {
  const [open, setOpen] = useState(defaultOpen);
  const entries = Object.entries(checks).filter(([, v]) => v && typeof v.passed === "boolean");
  const passed = entries.filter(([, v]) => v.passed).length;
  const total = entries.length;
  const allPassed = passed === total;
  const label = CATEGORY_LABELS[category] || category;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2.5 rounded-md border border-border hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className={`w-1.5 h-1.5 rounded-full ${allPassed ? "bg-emerald-500" : "bg-destructive"}`} />
          <span className="text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className={`text-xs font-mono ${allPassed ? "text-emerald-400" : "text-destructive"}`}>
            {passed}/{total}
          </span>
          <span className="text-muted-foreground text-[10px]">{open ? "▲" : "▼"}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 rounded-md border border-border overflow-hidden">
          {entries.map(([name, check]) => (
            <CheckRow key={name} name={name} passed={check.passed} detail={check.detail} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { CATEGORY_LABELS };
