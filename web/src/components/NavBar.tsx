"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/app", label: "App" },
  { href: "/stats", label: "Stats" },
  { href: "/developers", label: "Developers" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold">
          Torus
        </Link>
        <div className="flex items-center gap-5 text-sm">
          {links.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={isActive ? "font-medium underline underline-offset-4" : "text-zinc-500"}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
