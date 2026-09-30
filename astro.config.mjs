// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// 표를 가로 스크롤 래퍼로 감싼다. 좁은 표는 본문 폭을 채우고, 넓은 표만 스크롤된다
function rehypeTableWrap() {
	const walk = (node) => {
		if (!node.children) return;
		node.children = node.children.map((child) => {
			walk(child);
			if (child.type !== 'element' || child.tagName !== 'table') return child;
			return { type: 'element', tagName: 'div', properties: { className: ['table-wrap'] }, children: [child] };
		});
	};
	return (tree) => walk(tree);
}

// https://astro.build/config
export default defineConfig({
	site: 'https://marydev.me',
	base: '/',
	integrations: [mdx(), sitemap()],
	markdown: {
		rehypePlugins: [rehypeTableWrap],
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
		},
	},
});
