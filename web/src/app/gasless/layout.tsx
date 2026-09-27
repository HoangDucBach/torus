export default function GaslessLayout({ children }: LayoutProps<"/gasless">) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Gasless Demo</h1>
        <p>
          A third-party contract with zero knowledge of Torus, called gaslessly via EIP-7702
          through Torus&apos;s own paymaster endpoint.
        </p>
      </header>
      {children}
    </main>
  );
}
