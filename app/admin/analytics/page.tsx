import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminAnalyticsClient } from "@/components/admin/AdminAnalyticsClient";
import { hasAdminSession } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }

  return <AdminAnalyticsClient />;
}