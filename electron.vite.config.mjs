import { defineConfig } from 'electron-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    main: {
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
});
