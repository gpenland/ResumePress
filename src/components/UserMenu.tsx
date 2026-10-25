"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function UserMenu({
  user,
  signOutAction,
  triageCount = 0,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  signOutAction: () => Promise<void>;
  triageCount?: number;
}) {
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar>
              {user.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <div className="px-1.5 py-1">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <DropdownMenuItem render={<Link href="/settings/tokens" />}>
          API Tokens
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/email" />}>
          Email
          {triageCount > 0 && <Badge variant="secondary">{triageCount}</Badge>}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            signOutAction();
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
