export default function DevelopersLayout({ children }: LayoutProps<"/developers">) {
  return (
    <main className="flex flex-col max-w-4xl gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Developers</h1>
        <p>Everything a third-party protocol needs to sponsor gas through Torus.</p>
      </header>
      {children}
    </main>
  );
}
