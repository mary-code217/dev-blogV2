import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const contentSchema = z.object({
	title: z.string(),
	description: z.string(),
	date: z.coerce.date(),
	category: z.string(),
	tags: z.array(z.string()).optional().default([]),
	draft: z.boolean().optional().default(false),
});

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: contentSchema,
});

const wiki = defineCollection({
	loader: glob({ base: './src/content/wiki', pattern: '**/*.{md,mdx}' }),
	schema: contentSchema,
});

export const collections = { blog, wiki };
