<script lang="ts">
	import { base } from '$app/paths';
	import { theme } from '$lib/stores/theme';
	import { page } from '$app/stores';

	const navLinks = [
		{ href: `${base}/run`,  label: 'Run',     icon: 'fa-solid fa-play' },
		{ href: `${base}/help`, label: 'Help',    icon: 'fa-solid fa-circle-question' },
		{ href: `${base}/license`, label: 'License', icon: 'fa-solid fa-file-contract' }
	];

	let menuOpen = $state(false);

	function closeMenu() { menuOpen = false; }
</script>

<nav class="navbar">
	<a href="{base}/" class="logo" onclick={closeMenu}>Dezyme</a>

	<!-- Desktop links -->
	<div class="nav-links desktop">
		{#each navLinks as link}
			<a
				href={link.href}
				class="nav-link"
				class:active={$page.url.pathname === link.href}
			>
				<i class={link.icon}></i>
				<span>{link.label}</span>
			</a>
		{/each}
		<a
			href="https://3biocompbio.github.io/3BIO-Bioinfo/"
			class="nav-link nav-link--external"
			target="_blank"
			rel="noopener noreferrer"
		>
			<i class="fa-solid fa-flask"></i>
			<span>3BIO Lab</span>
		</a>
	</div>

	<div class="right">
		<button class="theme-toggle" onclick={() => theme.toggle()} aria-label="Toggle theme">
			{#if $theme === 'dark'}
				<i class="fa-solid fa-sun"></i>
			{:else}
				<i class="fa-solid fa-moon"></i>
			{/if}
		</button>

		<!-- Hamburger (mobile only) -->
		<button
			class="hamburger"
			onclick={() => (menuOpen = !menuOpen)}
			aria-label="Toggle menu"
			aria-expanded={menuOpen}
		>
			<i class={menuOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars'}></i>
		</button>
	</div>
</nav>

<!-- Mobile dropdown -->
{#if menuOpen}
	<div class="mobile-menu" role="menu">
		{#each navLinks as link}
			<a
				href={link.href}
				class="mobile-link"
				class:active={$page.url.pathname === link.href}
				onclick={closeMenu}
				role="menuitem"
			>
				<i class={link.icon}></i>
				{link.label}
			</a>
		{/each}
		<a
			href="https://3biocompbio.github.io/3BIO-Bioinfo/"
			class="mobile-link"
			target="_blank"
			rel="noopener noreferrer"
			onclick={closeMenu}
			role="menuitem"
		>
			<i class="fa-solid fa-flask"></i>
			3BIO Lab
			<i class="fa-solid fa-arrow-up-right-from-square fa-xs" style="margin-left:auto; opacity:0.5"></i>
		</a>
	</div>
{/if}

<style>
	.navbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.875rem 2rem;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
		position: sticky;
		top: 0;
		z-index: 20;
	}

	.logo {
		font-size: 1.2rem;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: var(--text);
		text-decoration: none;
		flex-shrink: 0;
	}

	/* Desktop links */
	.nav-links {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-left: auto;
	}

	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
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

	/* Right group */
	.right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	/* Desktop: push right group to the end */
	@media (min-width: 641px) {
		.right { margin-left: auto; }
		.nav-links { margin-left: auto; }
		/* cancel double margin */
		.nav-links + .right { margin-left: 0; }
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

	/* Hamburger */
	.hamburger {
		display: none;
		background: none;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.35rem 0.6rem;
		cursor: pointer;
		font-size: 1rem;
		color: var(--text);
		transition: border-color 0.15s;
	}

	.hamburger:hover {
		border-color: var(--text-muted);
	}

	/* Mobile dropdown */
	.mobile-menu {
		display: none;
		position: sticky;
		top: calc(3rem + 1px);
		z-index: 19;
		background: var(--bg);
		border-bottom: 1px solid var(--border);
		padding: 0.5rem 1rem;
		flex-direction: column;
		gap: 0.25rem;
	}

	.mobile-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.15s, background 0.15s;
	}

	.mobile-link:hover,
	.mobile-link.active {
		color: var(--text);
		background: var(--surface);
	}

	/* Mobile breakpoint */
	@media (max-width: 640px) {
		.navbar {
			padding: 0.75rem 1rem;
		}

		.desktop {
			display: none;
		}

		.hamburger {
			display: flex;
			align-items: center;
		}

		.mobile-menu {
			display: flex;
		}

		.right {
			margin-left: auto;
		}
	}
</style>
