"use client";
import { useEffect, useState } from "react";
import { secondsUntil } from "@/lib/utils";

interface RetryCountdownProps {
  nextRetryAt: string | null;
}

export default function RetryCountdown({ nextRetryAt }: RetryCountdownProps) {
  const [secs, setSecs] = useState(secondsUntil(nextRetryAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setSecs(secondsUntil(nextRetryAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [nextRetryAt]);

  if (!nextRetryAt || secs <= 0) return null;

  const pct = Math.max(0, Math.min(100, (secs / 30) * 100));

  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-amber-400">Retry in {secs}s</span>
      </div>
      <div className="h-1 bg-[#27272A] rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
