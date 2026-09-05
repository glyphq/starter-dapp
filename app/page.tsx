import type { Metadata } from "next";
import { StarterApp } from "@/components/starter-app";

export const metadata: Metadata = {
  title: "Wallet flows",
  description:
    "Connect a Qubic wallet, sign and verify messages, or review a real contract request.",
};

export default function Home() {
  return <StarterApp />;
}
