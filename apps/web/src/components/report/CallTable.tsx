"use client";
import { useState } from "react";
import type { CallLog } from "@/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import { cn, formatDuration, formatPhone } from "@/lib/utils";
import { X } from "lucide-react";

interface CallTableProps {
  logs: CallLog[];
}

export default function CallTable({ logs }: CallTableProps) {
  const [scriptModal, setScriptModal] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"child_name" | "status" | "attempt_number">("child_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = [...logs].sort((a, b) => {
    const av = String(a[sortKey] ?? "");
    const bv = String(b[sortKey] ?? "");
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <>
      <div className="bg-[#18181B] rounded-xl border border-[#27272A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A]">
                {[
                  { key: "child_name", label: "Child" },
                  { key: "status", label: "Status" },
                  { key: "attempt_number", label: "Tries" },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key as typeof sortKey)}
                    className="text-left px-4 py-3 text-xs font-medium text-[#A1A1AA] cursor-pointer hover:text-[#F4F4F5] whitespace-nowrap"
                  >
                    {label} {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A1A1AA]">Duration</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#A1A1AA]">Script</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((log, i) => (
                <tr
                  key={log.id}
                  className={cn(
                    "border-b border-[#27272A] last:border-0",
                    i % 2 === 0 ? "bg-transparent" : "bg-[#09090B]/30"
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#F4F4F5] truncate max-w-[100px]">{log.child_name}</p>
                    <p className="text-xs text-[#A1A1AA] truncate max-w-[100px]">{log.parent_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium", STATUS_COLORS[log.status])}>
                      {STATUS_LABELS[log.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#A1A1AA]">
                    {log.attempt_number}/{log.max_attempts}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#A1A1AA]">
                    {formatDuration(log.duration_seconds)}
                  </td>
                  <td className="px-4 py-3">
                    {log.ai_script && (
                      <button
                        onClick={() => setScriptModal(log.ai_script)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {scriptModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="bg-[#18181B] rounded-xl border border-[#27272A] w-full max-w-lg max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#27272A]">
              <h3 className="font-semibold text-[#F4F4F5]">AI Script</h3>
              <button onClick={() => setScriptModal(null)}>
                <X size={18} className="text-[#A1A1AA]" />
              </button>
            </div>
            <p className="p-4 text-sm text-[#A1A1AA] leading-relaxed overflow-y-auto">{scriptModal}</p>
          </div>
        </div>
      )}
    </>
  );
}
