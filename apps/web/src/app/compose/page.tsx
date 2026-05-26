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
import { Loader2, Users, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type Mode = "group" | "quick";
type Step = 1 | 2 | 3;

const quickSchema = z.object({
  phone_number: z.string().regex(/^\+91[6-9]\d{9}$/, "Format: +91XXXXXXXXXX"),
  parent_name: z.string().min(1, "Required"),
  child_name: z.string().min(1, "Required"),
});
type QuickForm = z.infer<typeof quickSchema>;

export default function ComposePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("group");
  const [step, setStep] = useState<Step>(1);
  const [selectedGroup, setSelectedGroup] = useState<ClassGroup | null>(null);
  const [language, setLanguage] = useState<"hindi" | "english">("hindi");
  const [message, setMessage] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const createCampaign = useCreateCampaign();

  const { data: groups, isLoading } = useQuery<ClassGroup[]>({
    queryKey: ["groups"],
    queryFn: async () => (await api.get("/groups")).data,
  });

  const quickForm = useForm<QuickForm>({
    resolver: zodResolver(quickSchema),
  });

  const handleGroupLaunch = async () => {
    if (!selectedGroup || !message.trim()) return;
    setLaunchError("");
    try {
      const campaign = await createCampaign.mutateAsync({
        class_group_id: selectedGroup.id,
        message_text: message.trim(),
        language,
      });
      router.push(`/live/${campaign.id}`);
    } catch {
      setLaunchError("Failed to start campaign. Try again.");
    }
  };

  const handleQuickLaunch = async (qf: QuickForm) => {
    if (!message.trim()) return;
    setIsLaunching(true);
    setLaunchError("");
    try {
      const res = await api.post("/campaigns/quick", {
        phone_number: qf.phone_number,
        parent_name: qf.parent_name,
        child_name: qf.child_name,
        message_text: message.trim(),
        language,
      });
      router.push(`/live/${res.data.id}`);
    } catch {
      setLaunchError("Failed to start call. Check the number and try again.");
    } finally {
      setIsLaunching(false);
    }
  };

  const totalSteps = 3;

  return (
    <AppShell title="New Alert" showBack onBack={() => router.back()}>
      <div className="px-4 pt-4 pb-6 space-y-6 max-w-lg mx-auto">

        {/* Mode toggle */}
        <div className="flex gap-2 p-1 bg-[#18181B] border border-[#27272A] rounded-xl">
          <button
            onClick={() => { setMode("group"); setStep(1); setMessage(""); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
              mode === "group"
                ? "bg-green-600 text-white"
                : "text-[#A1A1AA] hover:text-[#F4F4F5]"
            )}
          >
            <Users size={14} />
            Group Call
          </button>
          <button
            onClick={() => { setMode("quick"); setStep(1); setMessage(""); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
              mode === "quick"
                ? "bg-blue-600 text-white"
                : "text-[#A1A1AA] hover:text-[#F4F4F5]"
            )}
          >
            <Phone size={14} />
            Single Number
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  step === s
                    ? mode === "quick" ? "bg-blue-600 text-white" : "bg-green-600 text-white"
                    : step > s
                    ? mode === "quick" ? "bg-blue-900 text-blue-400" : "bg-green-900 text-green-400"
                    : "bg-[#27272A] text-[#71717A]"
                )}
              >
                {s}
              </div>
              {s < totalSteps && (
                <div
                  className={cn(
                    "flex-1 h-0.5 transition-all",
                    step > s
                      ? mode === "quick" ? "bg-blue-700" : "bg-green-700"
                      : "bg-[#27272A]"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── GROUP MODE ── */}
        {mode === "group" && (
          <>
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
                        onClick={() => { setSelectedGroup(g); setStep(2); }}
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

            {step === 2 && <LanguageStep language={language} setLanguage={setLanguage} onBack={() => setStep(1)} onNext={() => setStep(3)} accentColor="green" />}

            {step === 3 && (
              <div className="space-y-4">
                <MessageStep
                  message={message}
                  setMessage={setMessage}
                  language={language}
                  hint={selectedGroup ? `${selectedGroup.parent_count} parents will receive AI voice call in ${language}` : undefined}
                />
                {launchError && <p className="text-xs text-red-400">{launchError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 py-3 border border-[#27272A] rounded-xl text-sm text-[#A1A1AA] min-h-[48px]">Back</button>
                  <button
                    onClick={handleGroupLaunch}
                    disabled={!message.trim() || createCampaign.isPending}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-60 rounded-xl text-sm font-semibold text-white min-h-[48px] flex items-center justify-center gap-2 transition-colors"
                  >
                    {createCampaign.isPending && <Loader2 size={14} className="animate-spin" />}
                    🚀 Launch Calls ({selectedGroup?.parent_count ?? 0})
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── QUICK CALL MODE ── */}
        {mode === "quick" && (
          <form onSubmit={quickForm.handleSubmit(async (qf) => {
            if (step < 3) return;
            await handleQuickLaunch(qf);
          })}>
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-[#F4F4F5]">Enter Number</h2>
                  <p className="text-sm text-[#A1A1AA] mt-0.5">Call a single parent directly</p>
                </div>
                <div className="space-y-3">
                  {([
                    { field: "phone_number" as const, label: "Phone Number", placeholder: "+919876543210" },
                    { field: "parent_name" as const, label: "Parent Name", placeholder: "Rajesh Sharma" },
                    { field: "child_name" as const, label: "Child Name", placeholder: "Arjun Sharma" },
                  ]).map(({ field, label, placeholder }) => (
                    <div key={field}>
                      <label className="text-xs text-[#A1A1AA]">{label}</label>
                      <input
                        {...quickForm.register(field)}
                        placeholder={placeholder}
                        className="w-full mt-1 px-3 py-2.5 bg-[#18181B] border border-[#27272A] rounded-lg text-sm text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-[#52525B]"
                      />
                      {quickForm.formState.errors[field] && (
                        <p className="text-xs text-red-400 mt-1">{quickForm.formState.errors[field]?.message}</p>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await quickForm.trigger(["phone_number", "parent_name", "child_name"]);
                    if (ok) setStep(2);
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white min-h-[48px] transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            {step === 2 && <LanguageStep language={language} setLanguage={setLanguage} onBack={() => setStep(1)} onNext={() => setStep(3)} accentColor="blue" />}

            {step === 3 && (
              <div className="space-y-4">
                <MessageStep
                  message={message}
                  setMessage={setMessage}
                  language={language}
                  hint={`Calling ${quickForm.watch("parent_name") || "parent"} (${quickForm.watch("phone_number") || ""})`}
                />
                {launchError && <p className="text-xs text-red-400">{launchError}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(2)} className="flex-1 py-3 border border-[#27272A] rounded-xl text-sm text-[#A1A1AA] min-h-[48px]">Back</button>
                  <button
                    type="submit"
                    disabled={!message.trim() || isLaunching}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl text-sm font-semibold text-white min-h-[48px] flex items-center justify-center gap-2 transition-colors"
                  >
                    {isLaunching && <Loader2 size={14} className="animate-spin" />}
                    📞 Call Now
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </AppShell>
  );
}

/* ── Shared sub-components ── */

function LanguageStep({
  language, setLanguage, onBack, onNext, accentColor,
}: {
  language: "hindi" | "english";
  setLanguage: (l: "hindi" | "english") => void;
  onBack: () => void;
  onNext: () => void;
  accentColor: "green" | "blue";
}) {
  const accent = accentColor === "green" ? "border-green-600 bg-green-950/30" : "border-blue-600 bg-blue-950/30";
  const btnClass = accentColor === "green" ? "bg-green-600 hover:bg-green-500" : "bg-blue-600 hover:bg-blue-500";
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#F4F4F5]">Select Language</h2>
        <p className="text-sm text-[#A1A1AA] mt-0.5">AI will speak in this language</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["hindi", "english"] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang)}
            className={cn(
              "p-4 rounded-xl border transition-all",
              language === lang ? accent : "border-[#27272A] bg-[#18181B] hover:border-[#52525B]"
            )}
          >
            <p className="text-2xl">{lang === "hindi" ? "🇮🇳" : "🗣️"}</p>
            <p className="font-semibold text-[#F4F4F5] mt-2 capitalize">{lang}</p>
            <p className="text-xs text-[#A1A1AA] mt-0.5">{lang === "hindi" ? "Hinglish / Roman Hindi" : "Indian English"}</p>
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
        <button type="button" onClick={onBack} className="flex-1 py-3 border border-[#27272A] rounded-xl text-sm text-[#A1A1AA] min-h-[48px]">Back</button>
        <button type="button" onClick={onNext} className={cn("flex-1 py-3 rounded-xl text-sm font-semibold text-white min-h-[48px] transition-colors", btnClass)}>Continue</button>
      </div>
    </div>
  );
}

function MessageStep({
  message, setMessage, language, hint,
}: {
  message: string;
  setMessage: (m: string) => void;
  language: "hindi" | "english";
  hint?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#F4F4F5]">Type Your Message</h2>
        <p className="text-sm text-[#A1A1AA] mt-0.5">AI will speak exactly this — in {language}</p>
      </div>
      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder={language === "hindi"
            ? "e.g. Aaj bus 20 minute late aayegi. Bacchon ko thoda wait karna padega."
            : "e.g. Today the bus will be 20 minutes late. Please ask your child to wait."}
          className="w-full px-4 py-3 bg-[#18181B] border border-[#27272A] rounded-xl text-sm text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-[#52525B] resize-none leading-relaxed"
        />
        <div className="flex justify-end mt-1">
          <span className="text-xs text-[#71717A]">{message.length} chars</span>
        </div>
      </div>
      <TemplateCards language={language} onSelect={setMessage} />
      {hint && (
        <div className="p-3 bg-[#18181B] border border-[#27272A] rounded-xl">
          <p className="text-xs text-[#A1A1AA]">{hint}</p>
        </div>
      )}
    </div>
  );
}
