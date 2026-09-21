export default function StatsLayout({ children }: LayoutProps<"/stats">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Stats</h1>
        <p>Live, on-chain numbers from the Torus vault and paymaster — no wallet needed.</p>
      </header>
      {children}
    </main>
  );
}
