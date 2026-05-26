"use client";
import { Download, Printer } from "lucide-react";

interface ExportButtonsProps {
  campaignId: string;
}

export default function ExportButtons({ campaignId }: ExportButtonsProps) {
  const downloadCsv = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const token = localStorage.getItem("access_token");
    const url = `${apiUrl}/reports/${campaignId}/csv`;

    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign_${campaignId.slice(0, 8)}_report.csv`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
      });
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={downloadCsv}
        className="flex items-center gap-2 px-4 py-3 bg-[#18181B] border border-[#27272A] rounded-xl text-sm font-medium text-[#F4F4F5] hover:border-[#52525B] transition-colors flex-1 justify-center min-h-[48px]"
      >
        <Download size={16} />
        Download CSV
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-3 bg-[#18181B] border border-[#27272A] rounded-xl text-sm font-medium text-[#F4F4F5] hover:border-[#52525B] transition-colors flex-1 justify-center min-h-[48px]"
      >
        <Printer size={16} />
        Print
      </button>
    </div>
  );
}
