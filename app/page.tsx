import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { StarterApp } from "@/components/StarterApp";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Qubic Starter",
  description: "A minimal wallet workbench for Qubic apps.",
};

export default function Home() {
  return <div className={`${spaceGrotesk.variable} starter-font`}><StarterApp /></div>;
}
