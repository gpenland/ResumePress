"use server";

import { requireUserId } from "@/lib/auth";
import { disconnectGmailAccount } from "@/lib/gmailAccount";
import { revalidatePath } from "next/cache";

export async function disconnectGmail() {
  const userId = await requireUserId();
  await disconnectGmailAccount(userId);
  revalidatePath("/settings/gmail");
}
