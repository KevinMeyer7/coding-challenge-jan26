"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
      <div className="text-center max-w-md">
        <p className="text-4xl mb-4">🍎 💔 🍊</p>
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-sm text-[var(--color-muted)] mb-4">
          {error.message || "An unexpected error occurred in the dashboard."}
        </p>
        <button
          onClick={reset}
          className="btn-primary"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
