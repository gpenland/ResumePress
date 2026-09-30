import { z } from "zod";

// Shared entry/identity field constraints. Reused today by compile_resume; a
// deliberate goal is for create_entry/create_resume to be able to adopt these
// later without a breaking shape change, hence fields (e.g. `url`) that aren't
// consumed by every caller are still included here.
export const entryCoreFieldsSchema = z.object({
  title: z.string().min(1).max(200),
  organization: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  startDate: z.string().max(50).optional(),
  endDate: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
  bullets: z.array(z.string().max(500)).max(20).optional(),
  tags: z.array(z.string().max(100)).max(30).optional(),
  url: z.string().max(500).optional(),
});

export const identitySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  phone: z.string().max(50).optional(),
  website: z.string().max(300).optional(),
  linkedin: z.string().max(300).optional(),
  github: z.string().max(300).optional(),
});

export const inlineSectionSchema = z.object({
  categorySlug: z.string().min(1).max(50),
  categoryName: z.string().min(1).max(100),
  entries: z.array(entryCoreFieldsSchema).max(30),
});

export const compileResumeSchema = z.object({
  templateId: z.enum(["jake"]).default("jake"),
  identity: identitySchema,
  sections: z.array(inlineSectionSchema).max(10),
});
