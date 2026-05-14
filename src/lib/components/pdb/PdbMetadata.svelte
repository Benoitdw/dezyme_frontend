<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { base } from '$app/paths';
	import { theme } from '$lib/stores/theme';
	import type { PdbMetadata } from '$lib/utils/pdb';

	interface Props {
		meta: PdbMetadata;
		selectedChains?: string[];
		accent?: string;
	}

	let { meta, selectedChains = [], accent = '#6366f1' }: Props = $props();

	let viewerEl = $state<HTMLAnchorElement | undefined>();
	let viewer = $state<any>(null);
	const isPdbId = $derived(/^[A-Z0-9]{4}$/.test(meta.id));
	const viewerId = `lp-${Math.random().toString(36).slice(2)}`;

	const DIMMED_COLOR = [140, 140, 150];

	function hexToRgb(hex: string): [number, number, number] {
		const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
		return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [99, 102, 241];
	}

	onMount(() => {
		if (!isPdbId) return;

		function initViewer() {
			const lp = (window as any).LittleProteinStarter;
			viewer = lp.start(`#${viewerId}`, 180, 180, {
				backgroundColor: getBgColor()
			});
			viewer.fetch(meta.id);
		}

		if ((window as any).LittleProteinStarter) {
			initViewer();
		} else {
			const script = document.createElement('script');
			script.src = `${base}/littleprotein.js`;
			script.onload = initViewer;
			document.head.appendChild(script);
		}
	});

	$effect(() => {
		if (!viewer || meta.chains.length === 0) return;
		const selectedColor = hexToRgb(accent);
		const map: Record<string, number[]> = {};
		for (const chain of meta.chains) {
			map[chain] = selectedChains.includes(chain) ? selectedColor : DIMMED_COLOR;
		}
		viewer.setColorsMap(map);
	});

	$effect(() => {
		$theme;  // reactive: theme toggle
		accent;  // reactive: tool switch (surface var changes per tool)
		if (!viewer) return;
		// tick() ensures body[data-tool] is updated before we read --surface
		tick().then(() => viewer.setBackgroundColor(getBgColor()));
	});

	function getBgColor(): [number, number, number] {
		// read from body — tool themes override --surface there, not on :root
		const surface = getComputedStyle(document.body)
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
			<span class="meta-value meta-value--name">{meta.name}</span>
		</div>
		{#if meta.experimentType}
			<div class="meta-row">
				<span class="meta-label">Type</span>
				<span class="meta-value">{meta.experimentType}</span>
			</div>
		{/if}
		{#if meta.organism}
			<div class="meta-row">
				<span class="meta-label">Organism</span>
				<span class="meta-value">{meta.organism}</span>
			</div>
		{/if}
		<div class="meta-row">
			<span class="meta-label">Chains</span>
			<span class="meta-value">{meta.chains.join(', ')}</span>
		</div>
		{#if meta.residueCount !== undefined}
			<div class="meta-row">
				<span class="meta-label">Residues</span>
				<span class="meta-value">{meta.residueCount}</span>
			</div>
		{/if}
		{#if meta.ligandCount !== undefined && meta.ligandCount > 0}
			<div class="meta-row">
				<span class="meta-label">Ligands</span>
				<span class="meta-value">{meta.ligandCount}</span>
			</div>
		{/if}
		{#if meta.resolution}
			<div class="meta-row">
				<span class="meta-label">Resolution</span>
				<span class="meta-value">{meta.resolution} Å</span>
			</div>
		{/if}
		{#if meta.rFactor !== undefined}
			<div class="meta-row">
				<span class="meta-label">R-factor</span>
				<span class="meta-value">{meta.rFactor.toFixed(3)}</span>
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
		align-items: center;
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
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta-value--name {
		font-family: inherit;
		font-size: 0.82rem;
		white-space: normal;
		overflow: visible;
		text-overflow: unset;
		line-height: 1.4;
	}

	.viewer-wrap {
		width: 180px;
		height: 180px;
		flex-shrink: 0;
		border-radius: 0.5rem;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
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

	@media (max-width: 640px) {
		.meta-card {
			flex-direction: column;
			align-items: stretch;
		}

		.viewer-wrap {
			width: 100%;
			height: 200px;
			order: 1;
		}

		.meta-rows {
			order: 0;
		}
	}
</style>
