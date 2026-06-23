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
        { label: 'Introduction', slug: 'documentation/introduction' },
        {
          label: 'Getting Started',
          autogenerate: { directory: 'documentation/getting-started' },
        },
        {
          label: 'Architecture',
          autogenerate: { directory: 'documentation/architecture' },
        },
        {
          label: 'Backend',
          autogenerate: { directory: 'documentation/backend' },
        },
        {
          label: 'LIFF',
          autogenerate: { directory: 'documentation/liff' },
        },
        {
          label: 'Admin Dashboard',
          autogenerate: { directory: 'documentation/admin' },
        },
        {
          label: 'Payments',
          autogenerate: { directory: 'documentation/payments' },
        },
        {
          label: 'Deployment',
          autogenerate: { directory: 'documentation/deployment' },
        },
        {
          label: 'Operations',
          autogenerate: { directory: 'documentation/ops' },
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'documentation/reference' },
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
      ],
    }),
  ],
});
