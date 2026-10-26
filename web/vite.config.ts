import path from 'node:path';
import { reactRouter } from '@react-router/dev/vite';
import { reactRouterHonoServer } from 'react-router-hono-server/dev';
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';
import tsconfigPaths from 'vite-tsconfig-paths';
import { addRenderIds } from './plugins/addRenderIds';
import { aliases } from './plugins/aliases';
import consoleToParent from './plugins/console-to-parent';
import { layoutWrapperPlugin } from './plugins/layouts';
import { loadFontsFromTailwindSource } from './plugins/loadFontsFromTailwindSource';
import { nextPublicProcessEnv } from './plugins/nextPublicProcessEnv';
import { restart } from './plugins/restart';
import { restartEnvFileChange } from './plugins/restartEnvFileChange';

export default defineConfig({
  // Keep them available via import.meta.env.NEXT_PUBLIC_*
  envPrefix: 'NEXT_PUBLIC_',
  optimizeDeps: {
    // Explicitly include fast-glob, since it gets dynamically imported and we
    // don't want that to cause a re-bundle.
    include: [
      'fast-glob',
      'lucide-react',
      'react-aria-components',
      '@internationalized/date',
      '@internationalized/string',
      '@react-aria/utils',
      '@react-aria/i18n',
      '@react-stately/utils',
    ],
    exclude: [
      '@hono/auth-js/react',
      '@hono/auth-js',
      '@auth/core',
      '@hono/auth-js',
      'hono/context-storage',
      '@auth/core/errors',
      'fsevents',
      'lightningcss',
    ],
  },
  logLevel: 'info',
  plugins: [
    nextPublicProcessEnv(),
    restartEnvFileChange(),
    reactRouterHonoServer({
      serverEntryPoint: './__create/index.ts',
      runtime: process.env.NODE_ENV === 'production' ? 'bun' : 'node',
    }),
    babel({
      include: ['src/**/*.{js,jsx,ts,tsx}'], // or RegExp: /src\/.*\.[tj]sx?$/
      exclude: /node_modules/, // skip everything else
      babelConfig: {
        babelrc: false, // don’t merge other Babel files
        configFile: false,
        plugins: ['styled-jsx/babel'],
      },
    }),
    restart({
      restart: [
        'src/**/page.jsx',
        'src/**/page.tsx',
        'src/**/layout.jsx',
        'src/**/layout.tsx',
        'src/**/route.js',
        'src/**/route.ts',
      ],
    }),
    consoleToParent(),
    loadFontsFromTailwindSource(),
    addRenderIds(),
    reactRouter(),
    tsconfigPaths(),
    aliases(),
    layoutWrapperPlugin(),
  ],
  resolve: {
    alias: {
      // Dev runs under Node (Vite); remap bun adapter → node adapter so Bun.* globals aren't needed.
      // Production build (NODE_ENV=production) skips this → keeps bun adapter for Railway.
      ...(process.env.NODE_ENV !== 'production' ? {
        'react-router-hono-server/bun': 'react-router-hono-server/node',
      } : {}),
      lodash: 'lodash-es',
      'npm:stripe': 'stripe',
      stripe: path.resolve(__dirname, './src/__create/stripe'),
      '@auth/create/react': '@hono/auth-js/react',
      '@auth/create': path.resolve(__dirname, './src/__create/@auth/create'),
      '@': path.resolve(__dirname, 'src'),
      '@internationalized/string/dist/import.mjs': path.resolve(__dirname, 'node_modules/@internationalized/string/dist/index.mjs'),
      '@internationalized/date/dist/import.mjs': path.resolve(__dirname, 'node_modules/@internationalized/date/dist/index.mjs'),
      '@internationalized/number/dist/import.mjs': path.resolve(__dirname, 'node_modules/@internationalized/number/dist/index.mjs'),
      '@internationalized/message/dist/import.mjs': path.resolve(__dirname, 'node_modules/@internationalized/message/dist/index.mjs'),
    },
    dedupe: ['react', 'react-dom'],
  },
  clearScreen: false,
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port: 4000,
    fs: {
      allow: ['..', '../../shared'],
    },
    hmr: {
      overlay: false,
    },
    warmup: {
      clientFiles: ['./src/app/**/*', './src/app/root.tsx', './src/app/routes.ts'],
    },
  },
  ssr: {
    noExternal: [
      'react-aria',
      'react-stately',
      'react-aria-components',
      '@internationalized/date',
      '@internationalized/string',
      '@react-aria/utils',
      '@react-aria/i18n',
      '@react-stately/utils',
      '@radix-ui/react-popover',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      'class-variance-authority',
    ],
  },
  build: {
    target: 'esnext',
  },
});
