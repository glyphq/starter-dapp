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
    default: "Qubic Starter DApp",
    template: "%s | Qubic Starter DApp",
  },
  applicationName: "Qubic Starter DApp",
  description: "A minimal Next.js reference for Qubic wallet connectors, account state, transfers, message signing, and signature verification.",
  keywords: ["Qubic", "dApp", "wallet connectors", "Next.js", "WalletConnect"],
  openGraph: {
    title: "Qubic Starter DApp",
    description: "A minimal, reusable wallet connector reference for Qubic applications.",
    url: "/",
    siteName: "Qubic Starter DApp",
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
