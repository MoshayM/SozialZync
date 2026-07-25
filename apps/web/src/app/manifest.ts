import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sozialzync — AI YouTube Platform',
    short_name: 'Sozialzync',
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
  };
}
