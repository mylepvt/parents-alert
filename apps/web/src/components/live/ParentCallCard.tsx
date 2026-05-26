"use client";
import { useState } from "react";
import type { SSELog } from "@/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import { cn, formatPhone } from "@/lib/utils";
import SpeakingWave from "./SpeakingWave";
import RetryCountdown from "./RetryCountdown";
import { ChevronDown, ChevronUp, Phone } from "lucide-react";

interface ParentCallCardProps {
  log: SSELog;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  queued: <span className="w-2 h-2 rounded-full bg-zinc-500 inline-block" />,
  generating_script: <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />,
  ringing: <Phone size={14} className="text-blue-400 animate-pulse" />,
  busy: <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />,
  connected: null,
  done: <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />,
  failed: <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />,
  skipped: <span className="w-2 h-2 rounded-full bg-zinc-600 inline-block" />,
};

export default function ParentCallCard({ log }: ParentCallCardProps) {
  const [showScript, setShowScript] = useState(false);
  const isActive = log.status === "connected" || log.status === "ringing" || log.status === "generating_script";

  return (
    <div
      className={cn(
        "bg-[#18181B] rounded-xl border p-4 transition-all",
        isActive ? "border-blue-800 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]" : "border-[#27272A]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-1">
            {log.status === "connected" ? <SpeakingWave /> : STATUS_ICONS[log.status]}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#F4F4F5] truncate">{log.child_name}</p>
            <p className="text-xs text-[#A1A1AA] truncate">{log.parent_name} · {formatPhone(log.phone)}</p>
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <span className={cn("text-xs font-medium", STATUS_COLORS[log.status])}>
            {STATUS_LABELS[log.status]}
          </span>
          {log.max_attempts > 1 && (
            <p className="text-[10px] text-[#71717A] mt-0.5">
              Attempt {log.attempt_number}/{log.max_attempts}
            </p>
          )}
        </div>
      </div>

      {log.status === "busy" && log.next_retry_at && (
        <RetryCountdown nextRetryAt={log.next_retry_at} />
      )}

      {(log.status === "done" || log.status === "failed") && log.ai_script && (
        <div className="mt-2">
          <button
            onClick={() => setShowScript(!showScript)}
            className="flex items-center gap-1 text-[10px] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors"
          >
            {showScript ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            View Script
          </button>
          {showScript && (
            <p className="mt-2 text-xs text-[#A1A1AA] bg-[#09090B] rounded-lg p-3 leading-relaxed">
              {log.ai_script}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
