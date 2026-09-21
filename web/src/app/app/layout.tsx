export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">App</h1>
        <p>Deposit native USDC, withdraw torUSDC, and track your real earnings.</p>
      </header>
      {children}
    </main>
  );
}
