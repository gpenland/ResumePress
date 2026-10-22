"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { APPLICATION_STATUSES } from "@/lib/applicationsShared";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  size?: "sm" | "default";
  disabled?: boolean;
};

// Select.Value renders the raw value string, not a label — since our values
// already are the display labels (status names), we render `value` directly
// in the trigger rather than relying on SelectValue (see CLAUDE.md base-ui note).
export default function StatusSelect({ value, onValueChange, name, size = "default", disabled }: Props) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as string)}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger size={size}>
        <span>{value}</span>
      </SelectTrigger>
      <SelectContent>
        {APPLICATION_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
