import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { StarterApp } from "@/components/StarterApp";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wallet flows",
  description: "A concise Qubic workspace for wallet, QX, and signed message flows.",
};

export default function Home() {
  return <div className={`${spaceGrotesk.variable} starter-font`}><StarterApp /></div>;
}
