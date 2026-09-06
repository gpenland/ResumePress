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
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log("Seeded built-in categories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
