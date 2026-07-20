import type { Metadata } from "next";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist-mono/400.css";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://starter.glyphq.org"),
  title: "Glyph Qubic Starter",
  description: "Connect Qubic wallets through one clear React reference implementation.",
  openGraph: {
    title: "Glyph Qubic Starter",
    description: "A multi-wallet reference implementation for Qubic applications.",
    url: "/",
    siteName: "Glyph Qubic Starter",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
