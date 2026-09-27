"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Chip, Separator } from "@heroui/react";
import { Torus } from "@/components/icons/Torus";
import { ProtocolStatusCard } from "@/components/ProtocolStatusCard";
import { APP_VERSION } from "@/lib/constants";

const links = [
  { href: "/app", label: "Dashboard", icon: "solar:compass-bold-duotone" },
  { href: "/stats", label: "Stats", icon: "solar:pie-chart-2-bold-duotone" },
  { href: "/developers", label: "Developers", icon: "solar:code-2-bold-duotone" },
];

const exampleLinks = [{ href: "/gasless", label: "Gasless Demo", icon: "solar:bolt-bold-duotone" }];

function NavLink({
  href,
  label,
  icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-3 rounded-full px-4 py-2.5 text-sm ${
        isActive ? "font-medium text-foreground" : "text-foreground/60"
      }`}
    >
      {isActive ? (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-full bg-surface-secondary"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      ) : null}
      <Icon icon={icon} className="relative z-10 size-5" />
      <span className="relative z-10">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  // The landing page is its own full-viewport hero — the app sidebar only applies once
  // you're inside the dashboard.
  if (pathname === "/") return null;

  const isLinkActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto p-4">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Torus size={24} />
            <span className="text-lg font-semibold text-foreground">Torus</span>
          </div>
          <Chip size="sm" className="bg-purple-500/25">
            {APP_VERSION}
          </Chip>
        </div>

        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink key={link.href} {...link} isActive={isLinkActive(link.href)} />
          ))}

          <Separator className="my-2" />

          {exampleLinks.map((link) => (
            <NavLink key={link.href} {...link} isActive={isLinkActive(link.href)} />
          ))}
        </nav>
      </div>

      <ProtocolStatusCard />
    </aside>
  );
}
