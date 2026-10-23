"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { INTERACTION_TYPES } from "@/lib/interactionsShared";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  size?: "sm" | "default";
};

// See StatusSelect.tsx: Select.Value renders the raw value, not a label — our
// values already are the labels, so we render `value` directly in the trigger.
export default function InteractionTypeSelect({ value, onValueChange, name, size = "default" }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as string)} name={name}>
      <SelectTrigger size={size}>
        <span>{value}</span>
      </SelectTrigger>
      <SelectContent>
        {INTERACTION_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {type}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
