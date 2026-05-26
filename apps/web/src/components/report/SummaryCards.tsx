"use client";
import type { Report } from "@/types";
import { formatDuration } from "@/lib/utils";

interface SummaryCardsProps {
  report: Report;
}

export default function SummaryCards({ report }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-[#18181B] rounded-xl p-4 border border-[#27272A]">
        <p className="text-2xl font-bold text-[#F4F4F5]">{report.total_parents}</p>
        <p className="text-xs text-[#A1A1AA] mt-1">Total Parents</p>
      </div>
      <div className="bg-[#18181B] rounded-xl p-4 border border-[#27272A]">
        <p className="text-2xl font-bold text-green-500">{report.done_count}</p>
        <p className="text-xs text-[#A1A1AA] mt-1">Connected</p>
      </div>
      <div className="bg-[#18181B] rounded-xl p-4 border border-[#27272A]">
        <p className="text-2xl font-bold text-red-500">{report.failed_count}</p>
        <p className="text-xs text-[#A1A1AA] mt-1">Failed</p>
      </div>
      <div className="bg-[#18181B] rounded-xl p-4 border border-green-900">
        <p className="text-2xl font-bold text-green-400">{report.success_rate}%</p>
        <p className="text-xs text-[#A1A1AA] mt-1">Success Rate</p>
      </div>
      {report.duration_minutes !== null && (
        <div className="col-span-2 bg-[#18181B] rounded-xl p-4 border border-[#27272A]">
          <p className="text-2xl font-bold text-[#F4F4F5]">{report.duration_minutes}m</p>
          <p className="text-xs text-[#A1A1AA] mt-1">Total Duration</p>
        </div>
      )}
    </div>
  );
}
