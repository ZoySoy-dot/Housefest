import { Suspense } from "react";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPanel />
    </Suspense>
  );
}
