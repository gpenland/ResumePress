"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, MessageSquarePlus, Briefcase, FileText, UserPlus } from "lucide-react";
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
import { cn, nativeSelectClassName } from "@/lib/utils";

type Props = {
  contactOptions: { id: string; name: string }[];
  applicationOptions: { id: string; label: string }[];
  logInteraction: (formData: FormData) => Promise<void>;
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

// Mounted once in (protected)/layout.tsx so creating an Application, Entry,
// Contact, or Interaction is reachable from anywhere (PLAN.md §4: "quick-add
// available everywhere"), via the floating button's fan-out menu.
export default function GlobalQuickAdd({ contactOptions, applicationOptions, logInteraction }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fanOpen, setFanOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("Email");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!fanOpen) return;
    function handleOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFanOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setFanOpen(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [fanOpen]);

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

  const actions = [
    { key: "application", label: "New Application", icon: Briefcase, href: "/applications/new" },
    { key: "entry", label: "New Entry", icon: FileText, href: "/entries/new" },
    { key: "contact", label: "New Contact", icon: UserPlus, href: "/contacts/new" },
    {
      key: "interaction",
      label: "Log Interaction",
      icon: MessageSquarePlus,
      onClick: () => {
        setFanOpen(false);
        setOpen(true);
      },
    },
  ];

  return (
    <>
      <div ref={containerRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {actions.map((action, i) => {
          const Icon = action.icon;
          // Label + icon live in one element with one transform, so they
          // move as a single unit instead of drifting out of sync on their
          // own separate transitions (the previous jitter). The icon sits
          // in a size-12 box — matching the main button's own size — so its
          // *center*, not its edge, lines up with the main button's center
          // under the column's items-end alignment, regardless of the
          // icon circle's own (smaller) diameter.
          const content = (
            <>
              <span className="rounded-md border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md">
                {action.label}
              </span>
              <span className="flex size-12 shrink-0 items-center justify-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-md transition-colors hover:bg-secondary/80">
                  <Icon className="size-4" />
                </span>
              </span>
            </>
          );
          const style = {
            transitionDelay: fanOpen ? `${(actions.length - 1 - i) * 30}ms` : "0ms",
          } as React.CSSProperties;

          return (
            <div
              key={action.key}
              style={style}
              className={cn(
                "flex items-center gap-2 transition-[opacity,transform] duration-150 ease-out",
                fanOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5 pointer-events-none"
              )}
            >
              {action.href ? (
                <Link href={action.href} className="flex items-center gap-2" onClick={() => setFanOpen(false)}>
                  {content}
                </Link>
              ) : (
                <button type="button" className="flex items-center gap-2" onClick={action.onClick}>
                  {content}
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          aria-label={fanOpen ? "Close create menu" : "Create"}
          aria-expanded={fanOpen}
          title="Create"
          onClick={() => setFanOpen((v) => !v)}
          className="flex items-center justify-center size-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          {fanOpen ? <X className="size-5" /> : <Plus className="size-5" />}
        </button>
      </div>

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
              <select name="contactId" aria-label="Contact" defaultValue="" className={cn(nativeSelectClassName(), "w-full")}>
                <option value="">No contact</option>
                {contactOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            {applicationOptions.length > 0 && (
              <select name="applicationId" aria-label="Application" defaultValue="" className={cn(nativeSelectClassName(), "w-full")}>
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
