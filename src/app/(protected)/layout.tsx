import { redirect } from "next/navigation";
import { auth, isAllowedEmail } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }
  if (!isAllowedEmail(session.user.email)) {
    redirect("/unauthorized");
  }

  return children;
}
