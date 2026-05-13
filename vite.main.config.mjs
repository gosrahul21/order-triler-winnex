import { defineConfig } from 'vite';

// https://vitejs.dev/config
// NOTE: Do NOT list pure-JS packages (axios, dotenv, etc.) as external — Vite should
// bundle them so they are available inside the asar. Only list packages that have
// native add-ons (.node files) that absolutely cannot be bundled.
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        // Native MongoDB driver add-ons (optional, but safer to keep external)
        'kerberos',
        'mongodb-client-encryption',
        'snappy',
        '@mongodb-js/zstd',
        '@aws-sdk/credential-providers',
        'gcp-metadata',
        'socks',
      ],
    },
  },
});
