import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AI CreatorForce — YouTube Content OS',
    short_name: 'CreatorForce',
    description: 'AI-powered YouTube Content Operating System. Create, grow and publish with AI — research to viral shorts.',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    background_color: '#0e0924',
    theme_color: '#6D4AE0',
    orientation: 'portrait-primary',
    lang: 'en',
    dir: 'ltr',
    categories: ['productivity', 'entertainment', 'social'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'AI Copilot',
        url: '/copilot',
        description: 'Open the AI Copilot',
      },
      {
        name: 'New Project',
        url: '/projects',
        description: 'Start a new content project',
      },
      {
        name: 'Shorts Studio',
        url: '/shorts-studio',
        description: 'Create YouTube Shorts',
      },
    ],
    // @reason: Next.js MetadataRoute.Manifest['screenshots'] element type doesn't expose an index signature
    // Cast the whole array so we can include the standard W3C `form_factor` and `label` fields.
    screenshots: ([
      { src: '/screenshots/home.png',        sizes: '1280x800', type: 'image/png', form_factor: 'wide',   label: 'AI CreatorForce dashboard — YouTube Content OS' },
      { src: '/screenshots/copilot.png',     sizes: '1280x800', type: 'image/png', form_factor: 'wide',   label: 'AI Copilot — create content by conversation' },
      { src: '/screenshots/home-mobile.png', sizes: '390x844',  type: 'image/png', form_factor: 'narrow', label: 'Mobile dashboard' },
    ] as unknown) as MetadataRoute.Manifest['screenshots'],
  };
}
