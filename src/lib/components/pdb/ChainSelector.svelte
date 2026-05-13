<script lang="ts">
	import type { ChainRule } from '$lib/tools/types';

	interface Props {
		chains: string[];
		chainRule: ChainRule;
		selected: string[];
		onChange: (selected: string[]) => void;
	}

	let { chains, chainRule, selected = $bindable(), onChange }: Props = $props();

	function toggle(chain: string) {
		if (chainRule.multiple) {
			const next = selected.includes(chain)
				? selected.filter((c) => c !== chain)
				: [...selected, chain];
			onChange(next);
		} else {
			onChange([chain]);
		}
	}
</script>

<div class="chain-selector">
	{#each chains as chain}
		<button
			class="chain-btn"
			class:active={selected.includes(chain)}
			onclick={() => toggle(chain)}
			type="button"
		>
			{chain}
		</button>
	{/each}
	{#if !chainRule.multiple}
		<span class="hint">Single chain</span>
	{:else}
		<span class="hint">Multiple chains allowed</span>
	{/if}
</div>

<style>
	.chain-selector {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.chain-btn {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.35rem 0.75rem;
		font-size: 0.875rem;
		font-family: monospace;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s;
	}

	.chain-btn.active {
		background: var(--surface);
		border-color: var(--text);
		color: var(--text);
		font-weight: 600;
	}

	.hint {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-left: 0.25rem;
	}
</style>
