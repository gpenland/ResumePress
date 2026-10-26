import { redirect } from "next/navigation";
import { auth, isAllowedEmail } from "@/lib/auth";
import { listContactOptionsForUser } from "@/lib/contacts";
import { listApplicationOptionsForUser } from "@/lib/interactions";
import { logInteraction } from "./contacts/actions";
import GlobalQuickAdd from "@/components/contacts/GlobalQuickAdd";
import ResumeFlourish from "@/components/ResumeFlourish";

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

  const userId = session.user.id;
  const [contactOptions, applicationOptions] = await Promise.all([
    listContactOptionsForUser(userId),
    listApplicationOptionsForUser(userId),
  ]);

  return (
    <>
      {children}
      <GlobalQuickAdd
        contactOptions={contactOptions}
        applicationOptions={applicationOptions}
        logInteraction={logInteraction}
      />
      <ResumeFlourish />
    </>
  );
}
