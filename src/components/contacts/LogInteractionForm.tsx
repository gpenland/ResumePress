"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InteractionTypeSelect from "@/components/contacts/InteractionTypeSelect";

type Props = {
  contactId?: string;
  applicationId?: string;
  logInteraction: (formData: FormData) => Promise<void>;
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LogInteractionForm({ contactId, applicationId, logInteraction }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState("Email");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(formRef.current!);
    startTransition(async () => {
      await logInteraction(data);
      formRef.current?.reset();
      setType("Email");
    });
  }

  return (
    // Every control is the default 32px height and sits flush with the next;
    // the type picker fills its fixed-width slot instead of leaving a gap.
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      {contactId && <input type="hidden" name="contactId" value={contactId} />}
      {applicationId && <input type="hidden" name="applicationId" value={applicationId} />}
      <input type="hidden" name="type" value={type} />
      <InteractionTypeSelect value={type} onValueChange={setType} className="w-32" />
      <Input name="occurredAt" type="date" defaultValue={todayInputValue()} className="w-40" />
      <Input name="summary" placeholder="What happened?" required className="flex-1 min-w-48" />
      <Button type="submit" variant="outline" disabled={isPending}>{isPending ? "Logging…" : "Log"}</Button>
    </form>
  );
}
