"use client";

interface LiveStatsProps {
  total: number;
  done: number;
  failed: number;
  skipped: number;
}

export default function LiveStats({ total, done, failed, skipped }: LiveStatsProps) {
  const active = total - done - failed - skipped;

  return (
    <div className="grid grid-cols-4 gap-2">
      {[
        { label: "Total", value: total, color: "text-[#F4F4F5]" },
        { label: "Done ✓", value: done, color: "text-green-500" },
        { label: "Failed ✗", value: failed, color: "text-red-500" },
        { label: "Active", value: Math.max(0, active), color: "text-blue-400" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-[#18181B] rounded-xl p-3 text-center border border-[#27272A]">
          <p className={`text-xl font-bold ${color}`}>{value}</p>
          <p className="text-[10px] text-[#A1A1AA] mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}
