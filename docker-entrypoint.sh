#!/bin/sh
set -e

node node_modules/prisma/build/index.js migrate deploy

node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const cats = [
  { name: 'Experience', slug: 'experience' },
  { name: 'Projects',   slug: 'projects'   },
  { name: 'Skills',     slug: 'skills'     },
  { name: 'Education',  slug: 'education'  },
];
Promise.all(cats.map(async c => {
  const existing = await p.category.findFirst({ where: { userId: null, slug: c.slug } });
  if (!existing) await p.category.create({ data: { ...c, isBuiltIn: true, userId: null } });
}))
  .then(() => { console.log('categories seeded'); return p.\$disconnect(); })
  .catch(e => { console.error(e); process.exit(1); });
"

node server.js
