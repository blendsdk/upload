import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'en-US',
  title: 'BlendSDK Upload',
  description: 'Resumable file uploads for BlendSDK v5, React 19 and Fluent UI v9',
  base: '/upload/',
  cleanUrls: true,
  lastUpdated: true,
  head: [['meta', { name: 'theme-color', content: '#0f6cbd' }]],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Packages', link: '/packages/upload-core' },
      { text: 'Reference', link: '/reference/api' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Full-stack playground', link: '/guide/playground' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Server setup', link: '/guide/server' },
            { text: 'Client setup', link: '/guide/client' },
            { text: 'React component', link: '/guide/react-component' },
            { text: 'Policies', link: '/guide/policies' },
            { text: 'Storage', link: '/guide/storage' },
            { text: 'Security', link: '/guide/security' },
            { text: 'Operations', link: '/guide/operations' },
          ],
        },
      ],
      '/packages/': [
        {
          text: 'Packages',
          items: [
            { text: 'upload-core', link: '/packages/upload-core' },
            { text: 'upload-client', link: '/packages/upload-client' },
            { text: 'webafx-upload', link: '/packages/webafx-upload' },
            { text: 'fluentui-upload', link: '/packages/fluentui-upload' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'API overview', link: '/reference/api' },
            { text: 'Release process', link: '/reference/release' },
          ],
        },
      ],
    },
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/blendsdk/upload/edit/main/apps/docs/docs/:path',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/blendsdk/upload' }],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 TrueSoftware B.V.',
    },
  },
});
