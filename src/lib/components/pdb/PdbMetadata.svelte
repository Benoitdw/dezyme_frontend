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

	let viewer = $state<any>(null);
	const hasContent = $derived(!!meta.pdbContent);
	const viewerId = `lp-${Math.random().toString(36).slice(2)}`;

	const isPdbId   = $derived(/^[A-Z0-9]{4}$/.test(meta.id));
	const afMatch   = $derived(meta.id.match(/^AF-(.+)-F\d+$/));
	const rcsbUrl   = $derived(isPdbId ? `https://www.rcsb.org/structure/${meta.id}` : null);
	const afUrl     = $derived(afMatch ? `https://alphafold.ebi.ac.uk/entry/${afMatch[1]}` : null);

	function downloadPdb() {
		if (!meta.pdbContent) return;
		const blob = new Blob([meta.pdbContent], { type: 'text/plain' });
		const url  = URL.createObjectURL(blob);
		const a    = document.createElement('a');
		a.href     = url;
		a.download = `${meta.id}.pdb`;
		a.click();
		URL.revokeObjectURL(url);
	}

	const DIMMED_COLOR: [number, number, number] = [140, 140, 150];

	function hexToRgb(hex: string): [number, number, number] {
		const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
		return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [99, 102, 241];
	}

	onMount(() => {
		if (!hasContent) return;

		function initViewer() {
			const lp = (window as any).LittleProteinStarter;
			viewer = lp.start(`#${viewerId}`, 180, 180, {
				backgroundColor: getBgColor(),
				showAllModels: meta.assemblyIndex !== undefined
			});
			viewer.fromString(meta.pdbContent, meta.id);
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
		if (!viewer || !meta.pdbContent) return;
		// Biological units store their chain copies as separate MODELs; every other
		// multi-model file (NMR ensemble) is a single structure repeated
		viewer.setShowAllModels(meta.assemblyIndex !== undefined);
		viewer.fromString(meta.pdbContent, meta.id);
	});

	$effect(() => {
		if (!viewer || meta.chains.length === 0) return;
		const selectedColor = hexToRgb(accent);
		const copies = meta.chainCopies ?? {};
		const map: Record<string, number[]> = {};
		for (const chain of meta.chains) {
			const isSelected = selectedChains.includes(chain);
			const chainCopies = Math.max(copies[chain] ?? 1, 1);
			for (let copy = 1; copy <= chainCopies; copy++) {
				// Only the copy being analysed is colored — every other chain, and every
				// extra copy of the selected one, stays grey
				map[copy === 1 ? chain : `${chain}#${copy}`] =
					isSelected && copy === 1 ? selectedColor : DIMMED_COLOR;
			}
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
		{#if rcsbUrl || afUrl || hasContent}
			<div class="meta-row">
				<span class="meta-label">Links</span>
				<span class="meta-value meta-value--links">
					{#if rcsbUrl}
						<a href={rcsbUrl} target="_blank" rel="noopener noreferrer" class="ext-link">RCSB</a>
					{/if}
					{#if afUrl}
						<a href={afUrl} target="_blank" rel="noopener noreferrer" class="ext-link">AlphaFold</a>
					{/if}
					{#if hasContent}
						<button class="ext-link" onclick={downloadPdb} type="button">Download PDB</button>
					{/if}
				</span>
			</div>
		{/if}
		<div class="meta-row">
			<span class="meta-label">Name</span>
			<span class="meta-value meta-value--name">{meta.name}</span>
		</div>
		{#if meta.experimentType}
			<div class="meta-row">
				<span class="meta-label">Method</span>
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
			<span class="meta-value meta-value--chains">
				{#each meta.chains as chain, i (chain)}
					{@const info = meta.chainInfo?.[chain]}
					<span class="chain-tag" class:has-info={!!info}>
						{chain}
						{#if info}
							<span class="chain-tip">
								{#if info.name}<span class="chain-tip-name">{info.name}</span>{/if}
								<span class="chain-tip-len">{info.length} residues</span>
							</span>
						{/if}
					</span>{#if i < meta.chains.length - 1}<span class="chain-sep">,</span>{/if}
				{/each}
			</span>
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

	{#if hasContent}
		<div class="viewer-col">
			<div class="viewer-wrap">
				<div id={viewerId}></div>
			</div>
			<span class="viewer-credit">
				Rendered with
				<a href="https://github.com/MatsveiTsishyn/LittleProtein" target="_blank" rel="noopener noreferrer">LittleProtein</a>
			</span>
		</div>
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

	.meta-value--chains {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem;
		overflow: visible;   /* the hover card must not be clipped by the row */
	}

	.chain-sep {
		margin-right: 0.25rem;
	}

	.chain-tag {
		position: relative;
	}

	.chain-tag.has-info {
		cursor: help;
		border-bottom: 1px dotted var(--text-muted);
	}

	.chain-tip {
		position: absolute;
		bottom: calc(100% + 6px);
		left: -0.4rem;
		z-index: 5;
		display: none;
		flex-direction: column;
		gap: 0.1rem;
		width: max-content;
		max-width: 240px;
		padding: 0.35rem 0.55rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.12);
		/* the row is monospace, the hover card reads better in the page font */
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		white-space: normal;
		line-height: 1.35;
	}

	.chain-tag:hover .chain-tip {
		display: flex;
	}

	.chain-tip-name {
		font-size: 0.75rem;
		color: var(--text);
	}

	.chain-tip-len {
		font-size: 0.7rem;
		color: var(--text-muted);
	}

	.meta-value--links {
		font-family: inherit;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.ext-link {
		font-size: 0.75rem;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 0.3rem;
		padding: 0.1rem 0.4rem;
		text-decoration: none;
		transition: color 0.15s, border-color 0.15s;
		white-space: nowrap;
	}

	.ext-link:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	.viewer-col {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}

	.viewer-wrap {
		width: 180px;
		height: 180px;
		border-radius: 0.5rem;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.viewer-credit {
		font-size: 0.65rem;
		color: var(--text-muted);
		opacity: 0.8;
	}

	.viewer-credit a {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid var(--border);
	}

	.viewer-credit a:hover {
		color: var(--text);
		border-bottom-color: var(--text-muted);
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

		.viewer-col {
			width: 100%;
			order: 1;
		}

		.viewer-wrap {
			width: 100%;
			height: 200px;
		}

		.meta-rows {
			order: 0;
		}
	}
</style>
