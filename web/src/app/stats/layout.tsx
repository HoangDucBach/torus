export default function StatsLayout({ children }: LayoutProps<"/stats">) {
  return (
    <main className="mx-auto max-w-4xl flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Stats</h1>
        <p>Protocol stats.</p>
      </header>
      {children}
    </main>
  );
}
