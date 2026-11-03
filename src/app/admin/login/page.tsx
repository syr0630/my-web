import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { hasAdminSession, isAdminConfigured } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Admin access",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await hasAdminSession()) redirect("/admin/feedback");

  return <AdminLoginForm configured={isAdminConfigured()} />;
}