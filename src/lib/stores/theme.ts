import { browser } from '$app/environment';
import { writable } from 'svelte/store';

type Theme = 'light' | 'dark';

function createThemeStore() {
	const initial: Theme = browser
		? ((localStorage.getItem('dezyme_theme') as Theme) ?? 'light')
		: 'light';

	const { subscribe, set } = writable<Theme>(initial);

	if (browser) {
		document.documentElement.setAttribute('data-theme', initial);
	}

	return {
		subscribe,
		toggle() {
			const current = (document.documentElement.getAttribute('data-theme') as Theme) ?? 'light';
			const next: Theme = current === 'light' ? 'dark' : 'light';
			document.documentElement.setAttribute('data-theme', next);
			localStorage.setItem('dezyme_theme', next);
			set(next);
		}
	};
}

export const theme = createThemeStore();
