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
Promise.all(cats.map(c => p.category.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, isBuiltIn: true } })))
  .then(() => { console.log('categories seeded'); return p.\$disconnect(); })
  .catch(e => { console.error(e); process.exit(1); });
"

node server.js
