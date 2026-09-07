import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const builtInCategories = [
    { name: "Experience", slug: "experience", isBuiltIn: true },
    { name: "Projects", slug: "projects", isBuiltIn: true },
    { name: "Skills", slug: "skills", isBuiltIn: true },
    { name: "Education", slug: "education", isBuiltIn: true },
  ];

  for (const cat of builtInCategories) {
    // upsert can't target a compound unique key whose userId is NULL (Prisma/Postgres
    // limitation), so check-then-create instead.
    const existing = await prisma.category.findFirst({
      where: { userId: null, slug: cat.slug },
    });
    if (!existing) {
      await prisma.category.create({ data: { ...cat, userId: null } });
    }
  }

  console.log("Seeded built-in categories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
