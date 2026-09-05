import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist-mono/400.css";
import "./globals.css";
import { Providers } from "@/components/Providers";

const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();

export const metadata: Metadata = {
  metadataBase: appOrigin ? new URL(appOrigin) : undefined,
  title: {
    default: "Qubic Wallet Flows",
    template: "%s | Qubic Wallet Flows",
  },
  applicationName: "Qubic Wallet Flows",
  description: "A concise Qubic reference workspace for wallet connection, a simple smart-contract call, and signed messages.",
  keywords: ["Qubic", "dApp", "wallet connectors", "Next.js", "WalletConnect"],
  openGraph: {
    title: "Qubic Wallet Flows",
    description: "A concise reference workspace for Qubic wallet and smart-contract flows.",
    url: appOrigin || undefined,
    siteName: "Qubic Wallet Flows",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script id="glyph-custom-protocol-abort-guard" strategy="beforeInteractive">
          {`window.addEventListener("unhandledrejection",function(event){var reason=event.reason;if(reason&&typeof reason==="object"&&reason.name==="AbortError"&&reason.message==="The user aborted a request."){event.preventDefault();}},true);`}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
