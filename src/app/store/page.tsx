import type { Metadata } from "next";
import StoreClient from "@/components/StoreClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Store",
  description: "Official Student Council merch.",
};

export default function StorePage() {
  return <StoreClient />;
}
