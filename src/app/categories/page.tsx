export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { createCategory, deleteCategory } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default async function CategoriesPage() {
  const userId = await getUserId();
  const categories = await prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
    include: { _count: { select: { entries: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="text-muted-foreground text-sm mt-1">Built-in categories cannot be deleted</p>
      </div>

      {/* Category list — plain rows so spacing is fully controlled */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className={`flex items-center justify-between px-5 py-3 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{cat.name}</span>
              {cat.isBuiltIn && <Badge variant="secondary">built-in</Badge>}
              <span className="text-xs text-muted-foreground">{cat._count.entries} entries</span>
            </div>
            {!cat.isBuiltIn && (
              <form action={deleteCategory.bind(null, cat.id)}>
                <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  Delete
                </Button>
              </form>
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Custom Category</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCategory} className="flex gap-3">
            <Input name="name" required placeholder="Category name..." className="flex-1" />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
