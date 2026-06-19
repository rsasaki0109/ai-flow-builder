import Link from "next/link";

export default function FlowNotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-8 text-[var(--foreground)]">
      <section className="max-w-lg rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Flow not found</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          The flow may have been deleted.
        </p>
        <Link
          className="mt-5 inline-flex h-10 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)]"
          href="/"
        >
          Back to flows
        </Link>
      </section>
    </main>
  );
}
