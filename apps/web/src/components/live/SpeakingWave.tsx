"use client";

export default function SpeakingWave() {
  return (
    <div className="flex items-center gap-[3px] h-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="w-[3px] bg-green-500 rounded-full origin-bottom"
          style={{
            height: "100%",
            animation: `wave 0.9s ease-in-out ${(i - 1) * 0.1}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
