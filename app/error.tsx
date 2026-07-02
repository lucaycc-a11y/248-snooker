"use client";

import { Snooker404Table } from "./[locale]/Snooker404Table";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      data-nav-theme="dark"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black px-4 py-24 text-white sm:px-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,197,94,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.86))]" />

      <section className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-6 text-center">
        <div>
          <p
            data-cms-key="error.brand"
            className="mb-3 text-[13px] font-medium uppercase tracking-[0.32em] text-white/45"
          >
            Space8
          </p>
          <h1
            data-cms-key="error.code"
            className="font-['Bebas_Neue',Impact,sans-serif] text-[clamp(72px,20vw,160px)] leading-none tracking-[-0.02em] text-white"
          >
            TRY AGAIN
          </h1>
        </div>

        <p
          data-cms-key="error.subtitle"
          className="max-w-xl text-balance text-[17px] leading-relaxed text-white/55 sm:text-[19px]"
        >
          We lost this shot, but your next frame is still on. Take a break, then reload the table.
        </p>

        <Snooker404Table
          hint="Flick the balls around"
          completedText="All potted!"
          canvasLabel="Interactive snooker physics game"
        />

        <div className="flex w-full flex-col items-center gap-4 pt-2 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            data-cms-key="error.try_again"
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-[#22C55E] bg-[#22C55E] px-10 py-4 text-[17px] font-bold text-black transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] hover:bg-[#2BE66A] sm:w-auto"
          >
            Try Again
          </button>
          <a
            href="/"
            data-cms-key="error.home"
            className="flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-[15px] font-medium text-white/45 transition-colors duration-300 hover:text-white/75"
          >
            Back to Home
          </a>
        </div>
      </section>
    </main>
  );
}
