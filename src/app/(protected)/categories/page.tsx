export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { createCategory, deleteCategory } from "./actions";
import PageGrid, { GRID_INSET } from "@/components/PageGrid";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/Panel";
import { cn } from "@/lib/utils";
import SubmitButton from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default async function CategoriesPage() {
  const userId = await getUserId();
  const categories = await prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: { entries: { where: { userId: userId ?? "__none__" } } },
      },
    },
  });

  return (
    <PageGrid
      header={
        <PageHeader
          back={{ href: "/entries", label: "Entries" }}
          title="Categories"
          description="Built-in categories cannot be deleted"
        />
      }
    >
      <div className="space-y-8 lg:w-1/2">
      <Panel>
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className={cn("flex items-center justify-between py-3", GRID_INSET, i > 0 && "border-t")}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{cat.name}</span>
              {cat.isBuiltIn && <Badge variant="secondary">built-in</Badge>}
              <span className="text-xs text-muted-foreground">
                {cat._count.entries} {cat._count.entries === 1 ? "entry" : "entries"}
              </span>
            </div>
            {!cat.isBuiltIn && (
              <form action={deleteCategory.bind(null, cat.id)}>
                <SubmitButton
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  pendingText="Deleting…"
                >
                  Delete
                </SubmitButton>
              </form>
            )}
          </div>
        ))}
      </Panel>

      <Panel title="Add a custom category" padded>
        <form action={createCategory} className="flex gap-2">
          <Input name="name" required placeholder="Category name..." aria-label="Category name" autoComplete="off" data-1p-ignore className="flex-1" />
          <SubmitButton variant="outline" pendingText="Adding…">Add</SubmitButton>
        </form>
      </Panel>
      </div>
    </PageGrid>
  );
}
