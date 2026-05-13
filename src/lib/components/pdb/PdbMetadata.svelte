<script lang="ts">
	import type { PdbMetadata } from '$lib/utils/pdb';

	interface Props {
		meta: PdbMetadata;
	}

	let { meta }: Props = $props();
</script>

<div class="meta-card">
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

<style>
	.meta-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.meta-row {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
	}

	.meta-label {
		color: var(--text-muted);
		min-width: 90px;
	}

	.meta-value {
		color: var(--text);
		font-family: monospace;
	}
</style>
