"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import TemplateCards from "@/components/compose/TemplateCards";
import { useCreateCampaign } from "@/hooks/useCampaign";
import api from "@/lib/api";
import type { ClassGroup } from "@/types";
import { cn } from "@/lib/utils";
import { Loader2, Users } from "lucide-react";

type Step = 1 | 2 | 3;

export default function ComposePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [selectedGroup, setSelectedGroup] = useState<ClassGroup | null>(null);
  const [language, setLanguage] = useState<"hindi" | "english">("hindi");
  const [message, setMessage] = useState("");
  const createCampaign = useCreateCampaign();

  const { data: groups, isLoading } = useQuery<ClassGroup[]>({
    queryKey: ["groups"],
    queryFn: async () => (await api.get("/groups")).data,
  });

  const handleLaunch = async () => {
    if (!selectedGroup || !message.trim()) return;
    const campaign = await createCampaign.mutateAsync({
      class_group_id: selectedGroup.id,
      message_text: message.trim(),
      language,
    });
    router.push(`/live/${campaign.id}`);
  };

  return (
    <AppShell title="New Alert" showBack onBack={() => router.back()}>
      <div className="px-4 pt-4 pb-6 space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-0">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  step === s
                    ? "bg-green-600 text-white"
                    : step > s
                    ? "bg-green-900 text-green-400"
                    : "bg-[#27272A] text-[#71717A]"
                )}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 transition-all",
                    step > s ? "bg-green-700" : "bg-[#27272A]"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#F4F4F5]">Select Class Group</h2>
              <p className="text-sm text-[#A1A1AA] mt-0.5">Choose which group to notify</p>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-[#A1A1AA]" />
              </div>
            ) : !groups?.length ? (
              <div className="text-center py-8">
                <p className="text-[#A1A1AA] text-sm">No groups yet. Create one in Groups tab.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setSelectedGroup(g);
                      setStep(2);
                    }}
                    className={cn(
                      "text-left p-4 rounded-xl border transition-all min-h-[80px]",
                      selectedGroup?.id === g.id
                        ? "border-green-600 bg-green-950/30"
                        : "border-[#27272A] bg-[#18181B] hover:border-[#52525B]"
                    )}
                  >
                    <p className="font-semibold text-[#F4F4F5] text-sm">{g.name}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Users size={11} className="text-[#71717A]" />
                      <span className="text-xs text-[#A1A1AA]">{g.parent_count} parents</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#F4F4F5]">Select Language</h2>
              <p className="text-sm text-[#A1A1AA] mt-0.5">AI will speak in this language</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["hindi", "english"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={cn(
                    "p-4 rounded-xl border transition-all",
                    language === lang
                      ? "border-green-600 bg-green-950/30"
                      : "border-[#27272A] bg-[#18181B] hover:border-[#52525B]"
                  )}
                >
                  <p className="text-2xl">{lang === "hindi" ? "🇮🇳" : "🗣️"}</p>
                  <p className="font-semibold text-[#F4F4F5] mt-2 capitalize">{lang}</p>
                  <p className="text-xs text-[#A1A1AA] mt-0.5">
                    {lang === "hindi" ? "Hinglish / Roman Hindi" : "Indian English"}
                  </p>
                </button>
              ))}
            </div>
            <div className="p-3 bg-[#18181B] border border-[#27272A] rounded-xl">
              <p className="text-xs text-[#A1A1AA]">
                {language === "hindi"
                  ? "Preview: \"Namaste! Main Seth M R Jaipuria School ki taraf se bol raha hoon...\""
                  : "Preview: \"Hello! This is an important message from Seth M R Jaipuria School...\""}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 border border-[#27272A] rounded-xl text-sm text-[#A1A1AA] min-h-[48px]"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 bg-green-600 rounded-xl text-sm font-semibold text-white min-h-[48px]"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#F4F4F5]">Compose Message</h2>
              <p className="text-sm text-[#A1A1AA] mt-0.5">AI will turn this into a voice call script</p>
            </div>

            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Type your message here... e.g. Aaj bus 20 minute late aayegi"
                className="w-full px-4 py-3 bg-[#18181B] border border-[#27272A] rounded-xl text-sm text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-[#52525B] resize-none leading-relaxed"
              />
              <div className="flex justify-end mt-1">
                <span className="text-xs text-[#71717A]">{message.length} chars</span>
              </div>
            </div>

            <TemplateCards language={language} onSelect={setMessage} />

            {selectedGroup && (
              <div className="p-3 bg-[#18181B] border border-[#27272A] rounded-xl">
                <p className="text-xs text-[#A1A1AA]">
                  <span className="text-[#F4F4F5] font-medium">{selectedGroup.parent_count} parents</span>
                  {" "}will receive AI voice call in{" "}
                  <span className="text-[#F4F4F5] font-medium capitalize">{language}</span>
                </p>
              </div>
            )}

            {createCampaign.isError && (
              <p className="text-xs text-red-400">Failed to start campaign. Try again.</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 border border-[#27272A] rounded-xl text-sm text-[#A1A1AA] min-h-[48px]"
              >
                Back
              </button>
              <button
                onClick={handleLaunch}
                disabled={!message.trim() || createCampaign.isPending}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-60 rounded-xl text-sm font-semibold text-white min-h-[48px] flex items-center justify-center gap-2 transition-colors"
              >
                {createCampaign.isPending && <Loader2 size={14} className="animate-spin" />}
                🚀 Launch Calls ({selectedGroup?.parent_count ?? 0})
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
