import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/queries/users";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  const session = await getSession(await cookies());

  if (!session) {
    redirect("/");
  }

  const user = await getUserById(session.userId);
  if (!user || !isPlatformAdmin(user.email)) {
    redirect("/chat");
  }

  return <AdminDashboard />;
}
