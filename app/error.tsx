"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-white">
      <p className="text-white/60">出咗少少問題</p>
      <button onClick={() => reset()} className="rounded-full bg-[#1A6B35] px-5 py-2 text-sm font-semibold">
        重試
      </button>
    </div>
  );
}
