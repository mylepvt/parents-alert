"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import LiveStats from "@/components/live/LiveStats";
import CampaignProgressBar from "@/components/live/CampaignProgressBar";
import ParentCallCard from "@/components/live/ParentCallCard";
import { useSSE } from "@/hooks/useSSE";
import { useStopCampaign } from "@/hooks/useCampaign";
import { useCampaignStore } from "@/stores/campaignStore";
import type { SSEPayload } from "@/types";
import { Loader2, StopCircle } from "lucide-react";

export default function LivePage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const router = useRouter();
  const { liveData, setLiveData, clearLiveData } = useCampaignStore();
  const [connected, setConnected] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const stopCampaign = useStopCampaign();

  useEffect(() => {
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((lock) => {
        wakeLockRef.current = lock;
      }).catch(() => {});
    }
    return () => {
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  const { disconnect } = useSSE(campaignId, {
    onMessage: (data: SSEPayload) => {
      setConnected(true);
      setLiveData(data);
    },
    onDone: () => {
      wakeLockRef.current?.release().catch(() => {});
      // Browser push notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Bus Alert — Campaign Complete", {
          body: "All calls have been processed. Tap to view report.",
          icon: "/icons/icon-192x192.png",
        });
      }
      setTimeout(() => {
        clearLiveData();
        router.push(`/report/${campaignId}`);
      }, 1500);
    },
  });

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleStop = async () => {
    if (!confirmStop) {
      setConfirmStop(true);
      setTimeout(() => setConfirmStop(false), 3000);
      return;
    }
    disconnect();
    await stopCampaign.mutateAsync(campaignId);
    router.push(`/report/${campaignId}`);
  };

  const data = liveData;

  return (
    <AppShell title="Live Campaign" showBack onBack={() => router.push("/dashboard")} hideNav>
      <div className="px-4 pt-4 pb-6 space-y-4 max-w-lg mx-auto">
        {!connected ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={32} className="animate-spin text-[#A1A1AA]" />
            <p className="text-sm text-[#A1A1AA]">Connecting to campaign...</p>
          </div>
        ) : data ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#A1A1AA]">Campaign Running</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-400">Live</span>
                </div>
              </div>
              <button
                onClick={handleStop}
                disabled={stopCampaign.isPending}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-800 text-red-400 rounded-xl text-xs font-medium hover:bg-red-950/30 transition-colors min-h-[40px]"
              >
                <StopCircle size={14} />
                {confirmStop ? "Confirm Stop?" : "Stop"}
              </button>
            </div>

            <LiveStats
              total={data.campaign.total}
              done={data.campaign.done}
              failed={data.campaign.failed}
              skipped={data.campaign.skipped}
            />

            <CampaignProgressBar
              total={data.campaign.total}
              done={data.campaign.done}
              failed={data.campaign.failed}
            />

            {data.campaign.status === "done" && (
              <div className="p-4 bg-green-950/30 border border-green-800 rounded-xl text-center">
                <p className="text-green-400 font-semibold">Campaign Complete ✓</p>
                <p className="text-xs text-[#A1A1AA] mt-1">Redirecting to report...</p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-[#F4F4F5] mb-3">
                All Calls ({data.logs.length})
              </h3>
              <div className="space-y-2">
                {data.logs.map((log) => (
                  <ParentCallCard key={log.id} log={log} />
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
