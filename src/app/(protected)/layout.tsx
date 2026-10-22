import { redirect } from "next/navigation";
import { auth, isOwner } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }
  if (!isOwner(session.user.email)) {
    redirect("/unauthorized");
  }

  return children;
}
