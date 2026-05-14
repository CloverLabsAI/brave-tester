"use client";

import { useEffect, useState } from "react";

export default function TestPage() {
  const [status, setStatus] = useState("initializing");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setStatus("running");

        const { runAllChecks } = await import("@/lib/checks");

        const results = await runAllChecks((phase) => {
          if (!cancelled) setStatus(`phase: ${phase.phase}`);
        });

        (window as any).__testResults__ = results;
        (window as any).__testComplete__ = true;
        if (!cancelled) setStatus("complete");
      } catch (err: any) {
        (window as any).__testError__ = err?.message || String(err);
        (window as any).__testComplete__ = true;
        if (!cancelled) setStatus("error: " + (err?.message || String(err)));
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "monospace", color: "#22d3ee", background: "#0d0919", minHeight: "100vh" }}>
      <p>Brave Test Runner</p>
      <p>Status: {status}</p>
    </div>
  );
}
