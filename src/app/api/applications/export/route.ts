import { NextResponse } from "next/server";
import { getAllowedUserId } from "@/lib/auth";
import { listApplicationsForUser } from "@/lib/applications";
import { applicationsToCsv } from "@/lib/applicationsShared";

export async function GET() {
  const userId = await getAllowedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applications = await listApplicationsForUser(userId);
  const csv = applicationsToCsv(applications);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="applications.csv"`,
    },
  });
}
