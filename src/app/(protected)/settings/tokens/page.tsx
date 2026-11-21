export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/auth";
import { revokeApiToken } from "./actions";
import PageGrid, { GRID_INSET } from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { formatShortDate } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";
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
    <PageGrid
      header={
        <PageHeader
          eyebrow="Settings"
          title="API tokens"
          description={
            <p>
              Use a token to connect an MCP client (e.g. Claude) to your ResumePress data at{" "}
              <code className="text-xs">/api/mcp</code>.
            </p>
          }
        />
      }
    >
      <div className="space-y-8 lg:w-3/4">
      <Panel title="Tokens">
        {tokens.length === 0 && (
          <p className={cn("pb-3 text-sm text-muted-foreground", GRID_INSET)}>No tokens yet</p>
        )}
        {tokens.map((t, i) => {
          const revoked = !!t.revokedAt;
          const expired = !!t.expiresAt && t.expiresAt < new Date();
          return (
            <div
              key={t.id}
              className={cn("flex items-center justify-between py-3", GRID_INSET, i > 0 && "border-t")}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.name}</span>
                  {revoked && <Badge variant="secondary">revoked</Badge>}
                  {!revoked && expired && <Badge variant="secondary">expired</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">
                  Created {formatShortDate(t.createdAt)}
                  {t.lastUsedAt ? ` · Last used ${formatShortDate(t.lastUsedAt)}` : " · Never used"}
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
      </Panel>

      <Panel title="Create token" padded>
        <TokenCreateForm />
      </Panel>
      </div>
    </PageGrid>
  );
}
