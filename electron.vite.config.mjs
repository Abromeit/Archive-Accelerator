import { defineConfig } from 'electron-vite';
import { loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(function ({ mode }) {
    const env = loadEnv(mode, process.cwd(), 'GSC_');

    return {
        main: {
            define: {
                'process.env.GSC_CLIENT_ID': JSON.stringify(env.GSC_CLIENT_ID || ''),
                'process.env.GSC_CLIENT_SECRET': JSON.stringify(env.GSC_CLIENT_SECRET || ''),
            },
            build: {
                rollupOptions: {
                    external: ['better-sqlite3'],
                },
            },
        },
        preload: {},
        renderer: {
            plugins: [
                tailwindcss(),
            ],
        },
    };
});
