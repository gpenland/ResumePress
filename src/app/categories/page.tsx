export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { createCategory, deleteCategory } from "./actions";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
    include: { _count: { select: { entries: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 mb-8">Categories</h1>

      <div className="bg-white rounded-lg border border-zinc-200 divide-y divide-zinc-100 mb-8">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <span className="text-sm font-medium text-zinc-800">{cat.name}</span>
              {cat.isBuiltIn && (
                <span className="ml-2 text-xs text-zinc-400">built-in</span>
              )}
              <span className="ml-3 text-xs text-zinc-400">{cat._count.entries} entries</span>
            </div>
            {!cat.isBuiltIn && (
              <form action={deleteCategory.bind(null, cat.id)}>
                <button
                  type="submit"
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Delete
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Add Custom Category</h2>
        <form action={createCategory} className="flex gap-3">
          <input
            type="text"
            name="name"
            required
            placeholder="Category name..."
            className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
