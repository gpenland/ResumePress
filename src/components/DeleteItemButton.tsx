"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  action: () => Promise<void>;
  itemName: string;
};

export default function DeleteItemButton({ action, itemName }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleTrigger(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      await action();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleTrigger}
        aria-label={`Delete ${itemName}`}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <Trash2 className="size-3.5" />
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{itemName}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.stopPropagation(); handleConfirm(); }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
