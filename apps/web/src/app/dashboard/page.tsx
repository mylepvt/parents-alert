"use client";
import AppShell from "@/components/layout/AppShell";
import { useCampaigns } from "@/hooks/useCampaign";
import { useAuthStore } from "@/stores/authStore";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { CAMPAIGN_STATUS_COLORS } from "@/types";
import type { ClassGroup, Campaign } from "@/types";
import { formatRelativeTime, getGreeting } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Radio, Users, TrendingUp, Trash2 } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns();

  const deleteCampaign = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
  const { data: groups } = useQuery<ClassGroup[]>({
    queryKey: ["groups"],
    queryFn: async () => (await api.get("/groups")).data,
  });

  const totalParents = groups?.reduce((sum, g) => sum + g.parent_count, 0) ?? 0;
  const today = new Date().toDateString();
  const todayCampaigns = campaigns?.filter(
    (c) => new Date(c.created_at).toDateString() === today
  ) ?? [];
  const todayDone = todayCampaigns.reduce((sum, c) => sum + c.done_count, 0);
  const todayTotal = todayCampaigns.reduce((sum, c) => sum + c.total_parents, 0);
  const successRate = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  return (
    <AppShell title="Bus Alert">
      <div className="px-4 pt-5 pb-4 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-[#F4F4F5]">
            {getGreeting()}, {user?.username}
          </h2>
          <p className="text-sm text-[#A1A1AA] mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Groups", value: groups?.length ?? 0, icon: Users, color: "text-blue-400" },
            { label: "Parents", value: totalParents, icon: Users, color: "text-purple-400" },
            { label: "Calls Today", value: todayTotal, icon: Radio, color: "text-amber-400" },
            { label: "Success Rate", value: `${successRate}%`, icon: TrendingUp, color: "text-green-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#18181B] rounded-xl p-4 border border-[#27272A]">
              <Icon size={18} className={color} />
              <p className="text-xl font-bold text-[#F4F4F5] mt-2">{value}</p>
              <p className="text-xs text-[#A1A1AA] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <Link
          href="/compose"
          className="flex items-center justify-center gap-3 w-full py-4 bg-green-600 hover:bg-green-500 rounded-xl text-base font-semibold text-white transition-colors min-h-[56px]"
        >
          <Radio size={20} />
          New Alert Call
        </Link>

        <div>
          <h3 className="text-sm font-semibold text-[#F4F4F5] mb-3">Recent Campaigns</h3>
          {campaignsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-[#A1A1AA]" />
            </div>
          ) : !campaigns?.length ? (
            <div className="text-center py-8">
              <p className="text-[#A1A1AA] text-sm">No campaigns yet</p>
              <p className="text-[#71717A] text-xs mt-1">Create your first alert above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.slice(0, 10).map((c: Campaign) => (
                <div
                  key={c.id}
                  className="bg-[#18181B] rounded-xl border border-[#27272A] p-4 hover:border-[#52525B] transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <button
                      className="flex-1 text-left"
                      onClick={() =>
                        router.push(
                          c.status === "running" || c.status === "pending"
                            ? `/live/${c.id}`
                            : `/report/${c.id}`
                        )
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#F4F4F5] truncate">{c.group_name}</p>
                          <p className="text-xs text-[#A1A1AA] mt-0.5 truncate">{c.message_text}</p>
                        </div>
                        <span
                          className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${CAMPAIGN_STATUS_COLORS[c.status]}`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-[#71717A]">{c.done_count}/{c.total_parents} done</span>
                        <span className="text-xs text-[#71717A]">·</span>
                        <span className="text-xs text-[#71717A]">{formatRelativeTime(c.created_at)}</span>
                      </div>
                    </button>
                    <button
                      onClick={() => deleteCampaign.mutate(c.id)}
                      disabled={deleteCampaign.isPending}
                      className="p-2 text-[#52525B] hover:text-red-400 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
