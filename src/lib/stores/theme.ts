import { browser } from '$app/environment';
import { writable } from 'svelte/store';

type Theme = 'dark' | 'light';

function createThemeStore() {
	const initial: Theme = browser
		? ((localStorage.getItem('dezyme_theme') as Theme) ?? 'dark')
		: 'dark';

	const { subscribe, set } = writable<Theme>(initial);

	if (browser) {
		document.documentElement.setAttribute('data-theme', initial);
	}

	return {
		subscribe,
		toggle() {
			const current = (document.documentElement.getAttribute('data-theme') as Theme) ?? 'dark';
			const next: Theme = current === 'dark' ? 'light' : 'dark';
			document.documentElement.setAttribute('data-theme', next);
			localStorage.setItem('dezyme_theme', next);
			set(next);
		}
	};
}

export const theme = createThemeStore();
