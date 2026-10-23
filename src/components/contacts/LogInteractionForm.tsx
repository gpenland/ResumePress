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
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      {contactId && <input type="hidden" name="contactId" value={contactId} />}
      {applicationId && <input type="hidden" name="applicationId" value={applicationId} />}
      <input type="hidden" name="type" value={type} />
      <div className="w-32">
        <InteractionTypeSelect value={type} onValueChange={setType} size="sm" />
      </div>
      <Input name="occurredAt" type="date" defaultValue={todayInputValue()} className="w-40" />
      <Input name="summary" placeholder="What happened?" required className="flex-1 min-w-48" />
      <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Logging…" : "Log"}</Button>
    </form>
  );
}
