"use client";

interface CampaignProgressBarProps {
  total: number;
  done: number;
  failed: number;
}

export default function CampaignProgressBar({ total, done, failed }: CampaignProgressBarProps) {
  const pct = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
  const donePct = total > 0 ? (done / total) * 100 : 0;
  const failedPct = total > 0 ? (failed / total) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-[#F4F4F5]">{pct}% complete</span>
        <span className="text-xs text-[#A1A1AA]">{done + failed}/{total} calls done</span>
      </div>
      <div className="h-2 bg-[#27272A] rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${donePct}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-500"
          style={{ width: `${failedPct}%` }}
        />
      </div>
    </div>
  );
}
