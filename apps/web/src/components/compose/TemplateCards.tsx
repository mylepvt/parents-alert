"use client";

const TEMPLATES = [
  {
    id: "late",
    emoji: "🕐",
    title: "Bus Late",
    hindi: "Aaj bus thodi der se aayegi. Bacchon ko thodi der rukne ke liye taiyaar karein.",
    english: "Today the school bus is running a bit late. Please keep the children ready to wait a little longer.",
  },
  {
    id: "breakdown",
    emoji: "🔧",
    title: "Breakdown",
    hindi: "Aaj bus mein technical problem aayi hai. Kripya alternative arrangement karein ya school se contact karein.",
    english: "Today's bus has a technical issue. Please make alternative arrangements or contact the school.",
  },
  {
    id: "route",
    emoji: "📍",
    title: "Route Change",
    hindi: "Aaj bus ka route badal gaya hai. Naya pickup point ke baare mein details ke liye school se contact karein.",
    english: "Today's bus route has changed. Please contact the school for details about the new pickup point.",
  },
  {
    id: "early",
    emoji: "⏰",
    title: "Early Dismissal",
    hindi: "Aaj school jaldi chhutega. Bus normal time se pehle aayegi. Kripya taiyaar rahein.",
    english: "School will be dismissed early today. The bus will arrive before the usual time. Please be ready.",
  },
];

interface TemplateCardsProps {
  language: "hindi" | "english";
  onSelect: (text: string) => void;
}

export default function TemplateCards({ language, onSelect }: TemplateCardsProps) {
  return (
    <div>
      <p className="text-xs font-medium text-[#A1A1AA] mb-2 uppercase tracking-wide">Quick Templates</p>
      <div className="grid grid-cols-2 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(language === "hindi" ? t.hindi : t.english)}
            className="text-left p-3 bg-[#18181B] border border-[#27272A] rounded-xl hover:border-[#52525B] active:bg-[#27272A] transition-all min-h-[60px]"
          >
            <p className="text-base">{t.emoji}</p>
            <p className="text-xs font-medium text-[#F4F4F5] mt-1">{t.title}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
