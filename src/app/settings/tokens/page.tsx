export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { revokeApiToken } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SubmitButton from "@/components/SubmitButton";
import TokenCreateForm from "./TokenCreateForm";

export default async function ApiTokensPage() {
  const userId = await requireUserId();
  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Tokens</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Use a token to connect an MCP client (e.g. Claude) to your ResumePress data at{" "}
          <code className="text-xs">/api/mcp</code>.
        </p>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
        {tokens.length === 0 && (
          <div className="px-5 py-6 text-sm text-muted-foreground">No tokens yet.</div>
        )}
        {tokens.map((t, i) => {
          const revoked = !!t.revokedAt;
          const expired = !!t.expiresAt && t.expiresAt < new Date();
          return (
            <div
              key={t.id}
              className={`flex items-center justify-between px-5 py-3 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.name}</span>
                  {revoked && <Badge variant="secondary">revoked</Badge>}
                  {!revoked && expired && <Badge variant="secondary">expired</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">
                  Created {t.createdAt.toLocaleDateString()}
                  {t.lastUsedAt ? ` · Last used ${t.lastUsedAt.toLocaleDateString()}` : " · Never used"}
                </span>
              </div>
              {!revoked && (
                <form action={revokeApiToken.bind(null, t.id)}>
                  <SubmitButton
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    pendingText="Revoking…"
                  >
                    Revoke
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Token</CardTitle>
        </CardHeader>
        <CardContent>
          <TokenCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
