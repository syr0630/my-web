import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminFeedbackClient } from "@/components/admin/AdminFeedbackClient";
import { hasAdminSession } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Feedback inbox",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }

  return <AdminFeedbackClient />;
}