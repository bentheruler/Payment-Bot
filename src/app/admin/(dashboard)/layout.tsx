import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { AdminLayoutWrapper } from "@/components/admin/AdminLayoutWrapper";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  
  if (!session) {
    redirect("/admin/login");
  }

  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
