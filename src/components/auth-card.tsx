export function AuthCard({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-16">
      <section className="rounded-3xl border border-border bg-card px-6 py-10 shadow-sm sm:px-12">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {lead ? (
          <p className="mt-3 max-w-xl text-sm leading-6 text-foreground/80">
            {lead}
          </p>
        ) : null}
        <div className="mt-8 max-w-md">{children}</div>
      </section>
    </main>
  );
}
