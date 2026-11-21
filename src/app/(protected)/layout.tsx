import { redirect } from "next/navigation";
import { auth, isAllowedEmail } from "@/lib/auth";
import Link from "next/link";
import { gmailNeedsReauth } from "@/lib/gmailAccount";
import { listContactOptionsForUser } from "@/lib/contacts";
import { listApplicationOptionsForUser } from "@/lib/interactions";
import { logInteraction } from "./contacts/actions";
import GlobalQuickAdd from "@/components/contacts/GlobalQuickAdd";
import ResumeFlourish from "@/components/ResumeFlourish";
import SiteFooter from "@/components/SiteFooter";

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
  const [contactOptions, applicationOptions, emailNeedsReauth] = await Promise.all([
    listContactOptionsForUser(userId),
    listApplicationOptionsForUser(userId),
    gmailNeedsReauth(userId),
  ]);

  return (
    <>
      {emailNeedsReauth && (
        <div role="alert" className="border-b border-dashed border-destructive/40 bg-destructive/10 text-destructive text-sm px-4 py-2 text-center">
          Gmail access has expired and email sync is paused.{" "}
          <Link href="/api/gmail/oauth/start" className="font-medium underline">
            Reconnect Gmail
          </Link>
        </div>
      )}
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <GlobalQuickAdd
        contactOptions={contactOptions}
        applicationOptions={applicationOptions}
        logInteraction={logInteraction}
      />
      <ResumeFlourish />
    </>
  );
}
