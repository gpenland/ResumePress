"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import StatusBadge from "@/components/applications/StatusBadge";
import { APPLICATION_STATUSES } from "@/lib/applicationsShared";

type Props = {
  applicationId: string;
  status: string;
  updateStatus: (id: string, status: string) => Promise<void>;
};

// Clicking the badge swaps it for an already-open Select (defaultOpen), so
// one click surfaces the status options instead of needing a second click
// to open a dropdown. Selecting a value, or dismissing without one, both
// collapse it back to a plain badge.
export default function EditableStatusBadge({ applicationId, status, updateStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function handleChange(next: string) {
    setEditing(false);
    if (next === status) return;
    startTransition(async () => {
      await updateStatus(applicationId, next);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={isPending}
        aria-label={`Change status, currently ${status}`}
        className="cursor-pointer rounded-4xl disabled:cursor-not-allowed disabled:opacity-60"
      >
        <StatusBadge status={status} />
      </button>
    );
  }

  return (
    <Select
      value={status}
      onValueChange={(v) => handleChange(v as string)}
      defaultOpen
      onOpenChange={(open) => {
        if (!open) setEditing(false);
      }}
    >
      <SelectTrigger size="sm">
        <span>{status}</span>
      </SelectTrigger>
      <SelectContent>
        {APPLICATION_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
