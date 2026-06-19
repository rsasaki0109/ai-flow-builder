"use client";

export default function FlowEditorError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-8 text-[var(--foreground)]">
      <section className="max-w-lg rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Flow could not be loaded</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Reload the page or return to the flow list.
        </p>
      </section>
    </main>
  );
}
