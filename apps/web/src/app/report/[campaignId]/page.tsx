"use client";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import SummaryCards from "@/components/report/SummaryCards";
import SuccessDonut from "@/components/report/SuccessDonut";
import CallTable from "@/components/report/CallTable";
import ExportButtons from "@/components/report/ExportButtons";
import api from "@/lib/api";
import type { Report } from "@/types";
import { Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

export default function ReportPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const router = useRouter();

  const { data: report, isLoading } = useQuery<Report>({
    queryKey: ["report", campaignId],
    queryFn: async () => (await api.get(`/reports/${campaignId}`)).data,
    enabled: !!campaignId,
  });

  return (
    <AppShell title="Campaign Report" showBack onBack={() => router.push("/dashboard")}>
      <div className="px-4 pt-4 pb-6 space-y-5 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-[#A1A1AA]" />
          </div>
        ) : !report ? (
          <div className="text-center py-16">
            <p className="text-[#A1A1AA]">Report not found</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-950/50 border border-green-800 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={20} className="text-green-400" />
              </div>
              <div>
                <h2 className="font-bold text-[#F4F4F5]">Campaign Complete</h2>
                <p className="text-xs text-[#A1A1AA] mt-0.5">
                  {report.group_name} · {formatRelativeTime(report.ended_at)}
                </p>
              </div>
            </div>

            <SummaryCards report={report} />

            <SuccessDonut report={report} />

            <div className="bg-[#18181B] rounded-xl border border-[#27272A] p-4 space-y-2">
              <h3 className="text-sm font-semibold text-[#F4F4F5] mb-3">Campaign Details</h3>
              {[
                { label: "Class", value: report.group_name },
                { label: "Language", value: report.language === "hindi" ? "Hindi (Hinglish)" : "English" },
                { label: "Message", value: report.message_text },
                { label: "Started", value: report.started_at ? new Date(report.started_at).toLocaleString("en-IN") : "—" },
                { label: "Ended", value: report.ended_at ? new Date(report.ended_at).toLocaleString("en-IN") : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2">
                  <span className="text-xs text-[#71717A] w-20 flex-shrink-0">{label}</span>
                  <span className="text-xs text-[#A1A1AA] flex-1 break-words">{value}</span>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#F4F4F5] mb-3">
                All Calls ({report.logs.length})
              </h3>
              <CallTable logs={report.logs} />
            </div>

            <ExportButtons campaignId={campaignId} />

            <Link
              href="/compose"
              className="flex items-center justify-center w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl text-sm font-semibold text-white transition-colors min-h-[52px]"
            >
              🚀 New Alert
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
