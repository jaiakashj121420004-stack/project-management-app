/**
 * Placeholder app shell so the build runs end-to-end. The real Aurora design
 * system, routing, and app layout arrive in Phase 1 (see prompt.md / plan.md §4).
 */
export default function App() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0B0710] px-6 text-center">
      {/* Soft aurora glow — a hint of the look to come. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#7C3AED] via-[#EC4899] to-[#06B6D4] opacity-30 blur-[120px]"
      />
      <div className="relative z-10">
        <h1 className="bg-gradient-to-r from-[#7C3AED] via-[#EC4899] to-[#06B6D4] bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-7xl">
          Aurora
        </h1>
        <p className="mt-4 text-lg text-white/70 sm:text-xl">Coming soon.</p>
      </div>
    </main>
  );
}
