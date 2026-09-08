"use client";

import { useTransition } from "react";
import { Copy } from "lucide-react";

type Props = {
  action: () => Promise<void>;
  itemName: string;
};

export default function CloneItemButton({ action, itemName }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await action();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={`Clone ${itemName}`}
      className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
    >
      <Copy className="size-3.5" />
    </button>
  );
}
