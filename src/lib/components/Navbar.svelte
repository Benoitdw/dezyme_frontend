<script lang="ts">
	import { theme } from '$lib/stores/theme';
</script>

<nav class="navbar">
	<a href="/" class="logo">Dezyme</a>
	<button class="theme-toggle" onclick={() => theme.toggle()} aria-label="Toggle theme">
		{#if $theme === 'dark'}
			☀
		{:else}
			🌙
		{/if}
	</button>
</nav>

<style>
	.navbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 2rem;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.logo {
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--text);
		text-decoration: none;
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
	}

	.theme-toggle:hover {
		border-color: var(--text-muted);
	}
</style>
