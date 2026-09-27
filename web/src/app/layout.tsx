import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { PageTransition } from "@/components/PageTransition";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { Providers } from "./providers";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "Torus Stablecoin",
  description: "Self-paying gas on Arc — deposit native USDC, earn yield, pay gas from it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${dmSans.variable}`} data-theme="dark">
      <body className="bg-background text-foreground antialiased font-sans">
        <Providers>
          <div className="flex h-dvh overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <PageTransition>{children}</PageTransition>
              </div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
