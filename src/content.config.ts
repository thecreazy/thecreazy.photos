import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

export const SECTIONS = ['models', 'projects', 'travels', 'erotic'] as const;

const shooting = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/shooting' }),
  schema: z
    .object({
      name: z.string(),
      title: z.string().optional(),
      date: z.string().regex(/^\d{4}(-\d{2})?$/, 'use YYYY or YYYY-MM'),
      section: z.enum(SECTIONS),
      stock: z.string().optional(),
      bw: z.boolean().optional(),
      home: z.boolean().default(false),
      order: z.number().default(100),
      selected: z.array(z.number().int().positive()).min(1).max(3).optional(),
      hero: z.number().int().positive().optional(),
      photos: z.array(z.string()).min(1),
      note: z.string().optional(),
      envelope: z.number().int().positive().optional(), // envelope number printed on the page; default 100 + position in the site-wide order
      alts: z.record(z.string(), z.string()).optional(), // optional alt text per photo: filename → text (generic "Name, frame N" when missing)
      noindex: z.boolean().optional(), // keep this shooting's page out of search engines and the sitemap (the page stays online)
    })
    .refine((d) => !d.selected || d.selected.every((i) => i <= d.photos.length), {
      message: 'selected: index out of range',
    })
    .refine((d) => !d.hero || d.hero <= d.photos.length, { message: 'hero: index out of range' })
    .refine((d) => !d.alts || Object.keys(d.alts).every((f) => d.photos.includes(f)), { message: 'alts: filename not in photos' }),
});

export const collections = { shooting };
