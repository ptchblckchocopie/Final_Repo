import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.ts'],
		globals: true,
		setupFiles: ['src/test-setup.ts']
	},
	server: {
		allowedHosts: ['.ngrok-free.dev'],
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true
			},
			'/ws/snake': {
				target: 'ws://localhost:3001',
				ws: true
			},
			'/ws': {
				target: 'ws://localhost:3001',
				ws: true
			}
		}
	}
});
