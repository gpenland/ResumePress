"use client";

import { useActionState, useState } from "react";
import { createApiToken } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type State = { token: string; name: string } | null;

export default function TokenCreateForm() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction, isPending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const name = (formData.get("name") as string) || "Untitled token";
      const { token } = await createApiToken(name);
      return { token, name };
    },
    null
  );

  return (
    <>
      <form
        action={(formData) => {
          formAction(formData);
          setOpen(true);
        }}
        className="flex gap-3"
      >
        <Input name="name" required placeholder="Token name (e.g. Claude)..." className="flex-1" />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create token"}
        </Button>
      </form>

      <AlertDialog
        open={open && !!state}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setCopied(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Token created</AlertDialogTitle>
            <AlertDialogDescription>
              Copy this token now — you won&apos;t be able to see it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <code className="block break-all rounded-md bg-muted px-3 py-2 text-xs">
            {state?.token}
          </code>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="outline"
              onClick={() => {
                if (state?.token) {
                  navigator.clipboard.writeText(state.token);
                  setCopied(true);
                }
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </AlertDialogAction>
            <AlertDialogAction onClick={() => setOpen(false)}>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
