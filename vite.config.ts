import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '0.0.0.0',
		port: 5173,
		proxy: {
			'/dezyme/api': {
				target: 'http://backend:8000',
				rewrite: (path) => path.replace(/^\/dezyme/, '')
			},
			'/api': 'http://backend:8000'
		}
	},
	optimizeDeps: {
		include: ['3dmol']
	}
});
