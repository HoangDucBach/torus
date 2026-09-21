import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Torus Protocol",
  description: "Self-paying gas on Arc — deposit native USDC, earn yield, pay gas from it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
