<script lang="ts">
	import { base } from '$app/paths';
	import { theme } from '$lib/stores/theme';
	import { page } from '$app/stores';

	const navLinks = [
		{ href: `${base}/run`, label: 'Run' },
		{ href: `${base}/help`, label: 'Help' },
		{ href: `${base}/license`, label: 'License' }
	];
</script>

<nav class="navbar">
	<a href="{base}/" class="logo">Dezyme</a>

	<div class="nav-links">
		{#each navLinks as link}
			<a
				href={link.href}
				class="nav-link"
				class:active={$page.url.pathname === link.href}
			>{link.label}</a>
		{/each}
		<a
			href="https://3biocompbio.github.io/3BIO-Bioinfo/"
			class="nav-link nav-link--external"
			target="_blank"
			rel="noopener noreferrer"
		>
			3BIO Lab
			<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</a>
	</div>

	<button class="theme-toggle" onclick={() => theme.toggle()} aria-label="Toggle theme">
		{#if $theme === 'dark'}☀{:else}🌙{/if}
	</button>
</nav>

<style>
	.navbar {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.875rem 2rem;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.logo {
		font-size: 1.2rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: var(--text);
		text-decoration: none;
		flex-shrink: 0;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-left: auto;
	}

	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.4rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.15s, background 0.15s;
	}

	.nav-link:hover,
	.nav-link.active {
		color: var(--text);
		background: var(--surface);
	}

	.nav-link--external {
		color: var(--text-muted);
	}

	.theme-toggle {
		background: none;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.35rem 0.6rem;
		cursor: pointer;
		font-size: 1rem;
		color: var(--text);
		transition: border-color 0.15s;
		flex-shrink: 0;
	}

	.theme-toggle:hover {
		border-color: var(--text-muted);
	}
</style>
