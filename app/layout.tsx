import type { Metadata } from "next";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist-mono/400.css";
import "./globals.css";
import { Providers } from "@/components/Providers";

const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://starter.glyphq.org";

export const metadata: Metadata = {
  metadataBase: new URL(appOrigin),
  title: {
    default: "Qubic Wallet Flows",
    template: "%s | Qubic Wallet Flows",
  },
  applicationName: "Qubic Wallet Flows",
  description: "A concise Qubic reference workspace for wallet connection, QX fees, and signed messages.",
  keywords: ["Qubic", "dApp", "wallet connectors", "Next.js", "WalletConnect"],
  openGraph: {
    title: "Qubic Wallet Flows",
    description: "A concise reference workspace for Qubic wallet and smart-contract flows.",
    url: "/",
    siteName: "Qubic Wallet Flows",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning><Providers>{children}</Providers></body>
    </html>
  );
}
