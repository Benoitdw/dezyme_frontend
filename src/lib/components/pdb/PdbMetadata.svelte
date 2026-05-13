<script lang="ts">
	import { onMount } from 'svelte';
	import type { PdbMetadata } from '$lib/utils/pdb';

	interface Props {
		meta: PdbMetadata;
	}

	let { meta }: Props = $props();

	let viewerEl: HTMLAnchorElement | undefined;
	const isPdbId = /^[A-Z0-9]{4}$/.test(meta.id);
	const viewerId = `lp-${Math.random().toString(36).slice(2)}`;

	onMount(() => {
		if (!isPdbId) return;

		function initViewer() {
			const lp = (window as any).LittleProteinStarter;
			const viewer = lp.start(`#${viewerId}`, 180, 180, {
				backgroundColor: getBgColor()
			});
			viewer.fetch(meta.id);
		}

		if ((window as any).LittleProteinStarter) {
			initViewer();
		} else {
			const script = document.createElement('script');
			script.src = '/littleprotein.js';
			script.onload = initViewer;
			document.head.appendChild(script);
		}
	});

	function getBgColor(): [number, number, number] {
		const surface = getComputedStyle(document.documentElement)
			.getPropertyValue('--surface')
			.trim();
		const m = surface.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
		if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
		return [255, 255, 255];
	}
</script>

<div class="meta-card">
	<div class="meta-rows">
		<div class="meta-row">
			<span class="meta-label">Structure</span>
			<span class="meta-value">{meta.id}</span>
		</div>
		<div class="meta-row">
			<span class="meta-label">Name</span>
			<span class="meta-value">{meta.name}</span>
		</div>
		<div class="meta-row">
			<span class="meta-label">Chains</span>
			<span class="meta-value">{meta.chains.join(', ')}</span>
		</div>
		{#if meta.resolution}
			<div class="meta-row">
				<span class="meta-label">Resolution</span>
				<span class="meta-value">{meta.resolution}</span>
			</div>
		{/if}
		{#if meta.organism}
			<div class="meta-row">
				<span class="meta-label">Organism</span>
				<span class="meta-value">{meta.organism}</span>
			</div>
		{/if}
	</div>

	{#if isPdbId}
		<a
			class="viewer-wrap"
			bind:this={viewerEl}
			href="https://github.com/MatsveiTsishyn/LittleProtein"
			target="_blank"
			rel="noopener noreferrer"
			aria-label="Powered by LittleProtein"
		>
			<div id={viewerId}></div>
		</a>
	{/if}
</div>

<style>
	.meta-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
		display: flex;
		gap: 1rem;
		align-items: stretch;
	}

	.meta-rows {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		flex: 1;
		min-width: 0;
	}

	.meta-row {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
	}

	.meta-label {
		color: var(--text-muted);
		min-width: 90px;
		flex-shrink: 0;
	}

	.meta-value {
		color: var(--text);
		font-family: monospace;
	}

	.viewer-wrap {
		width: 180px;
		height: 180px;
		flex-shrink: 0;
		border-radius: 0.5rem;
		overflow: hidden;
		display: block;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.viewer-wrap:hover {
		opacity: 0.85;
	}

	.viewer-wrap :global(canvas) {
		display: block;
		border-radius: 0.5rem;
	}
</style>
