export default async function GuestEventRoute({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <p className="font-mono text-sm text-foreground/70">/e/{code}</p>
    </main>
  );
}
