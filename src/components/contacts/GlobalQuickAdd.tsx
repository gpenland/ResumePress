"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import InteractionTypeSelect from "@/components/contacts/InteractionTypeSelect";

type Props = {
  contactOptions: { id: string; name: string }[];
  applicationOptions: { id: string; label: string }[];
  logInteraction: (formData: FormData) => Promise<void>;
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

// Mounted once in (protected)/layout.tsx so "Log interaction" is reachable
// from anywhere (PLAN.md §4: "quick-add available everywhere"), via the
// floating button or the "i" keyboard shortcut.
export default function GlobalQuickAdd({ contactOptions, applicationOptions, logInteraction }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("Email");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "i" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      e.preventDefault();
      setOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (contactOptions.length === 0 && applicationOptions.length === 0) {
    // Nothing to link to yet (no contacts or applications at all) — the
    // per-contact quick-add on the contact detail page still works once one exists.
    return null;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(formRef.current!);
    startTransition(async () => {
      await logInteraction(data);
      setOpen(false);
      setType("Email");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Log interaction"
        title='Log interaction ("i")'
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center size-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
      >
        <MessageSquarePlus className="size-5" />
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Log interaction</AlertDialogTitle>
          </AlertDialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
            <input type="hidden" name="type" value={type} />
            <InteractionTypeSelect value={type} onValueChange={setType} />

            <Input name="occurredAt" type="date" defaultValue={todayInputValue()} />

            {contactOptions.length > 0 && (
              <select name="contactId" aria-label="Contact" defaultValue="" className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">No contact</option>
                {contactOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            {applicationOptions.length > 0 && (
              <select name="applicationId" aria-label="Application" defaultValue="" className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">No application</option>
                {applicationOptions.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            )}

            <Input name="summary" placeholder="What happened?" required />

            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={isPending}>
                {isPending ? "Logging…" : "Log"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
