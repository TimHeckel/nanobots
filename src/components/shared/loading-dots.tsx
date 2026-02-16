"use client";

export function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1">
      <span
        className="block w-2 h-2 rounded-full bg-green-neon animate-[loading-dot_1.4s_ease-in-out_infinite]"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="block w-2 h-2 rounded-full bg-green-neon animate-[loading-dot_1.4s_ease-in-out_infinite]"
        style={{ animationDelay: "200ms" }}
      />
      <span
        className="block w-2 h-2 rounded-full bg-green-neon animate-[loading-dot_1.4s_ease-in-out_infinite]"
        style={{ animationDelay: "400ms" }}
      />
      <style>{`
        @keyframes loading-dot {
          0%, 80%, 100% {
            opacity: 0.2;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
