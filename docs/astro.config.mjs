import { defineConfig, passthroughImageService } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://tinadiet.com',
  image: {
    // Skip Sharp-based image optimization — passthrough is fine for a docs site
    // with one mascot. Avoids Sharp's flaky Windows install.
    service: passthroughImageService(),
  },
  integrations: [
    starlight({
      title: 'Tina Diet Docs',
      description:
        'Developer documentation for Tina Diet — AI nutrition coach for Thailand built on LINE LIFF + Express + Cloudflare.',
      logo: {
        src: './src/assets/mascot.png',
        replacesTitle: false,
      },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/brand.css'],
      social: {
        github: 'https://github.com/einsze/tinadiet',
      },
      editLink: {
        baseUrl:
          'https://github.com/einsze/tinadiet/edit/main/projects/docs/',
      },
      lastUpdated: true,
      pagination: true,
      sidebar: [
        { label: 'Introduction', slug: 'docsfordevtina/introduction' },
        {
          label: 'Getting Started',
          autogenerate: { directory: 'docsfordevtina/getting-started' },
        },
        {
          label: 'Architecture',
          autogenerate: { directory: 'docsfordevtina/architecture' },
        },
        {
          label: 'Backend',
          autogenerate: { directory: 'docsfordevtina/backend' },
        },
        {
          label: 'LIFF',
          autogenerate: { directory: 'docsfordevtina/liff' },
        },
        {
          label: 'Admin Dashboard',
          autogenerate: { directory: 'docsfordevtina/admin' },
        },
        {
          label: 'Payments',
          autogenerate: { directory: 'docsfordevtina/payments' },
        },
        {
          label: 'Deployment',
          autogenerate: { directory: 'docsfordevtina/deployment' },
        },
        {
          label: 'Operations',
          autogenerate: { directory: 'docsfordevtina/ops' },
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'docsfordevtina/reference' },
        },
      ],
      head: [
        {
          tag: 'meta',
          attrs: {
            name: 'theme-color',
            content: '#ec4571',
          },
        },
        // Defense-in-depth: tell search engines NOT to index the dev docs.
        // (Obscure path + noindex + robots.txt combined; can be upgraded to
        // Cloudflare Access auth later if collaborator count grows.)
        {
          tag: 'meta',
          attrs: {
            name: 'robots',
            content: 'noindex, nofollow',
          },
        },
      ],
    }),
  ],
});
