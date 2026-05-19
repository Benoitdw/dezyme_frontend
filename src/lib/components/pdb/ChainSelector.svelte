<script lang="ts">
	import type { ChainRule } from '$lib/tools/types';
	import type { ChainInfo } from '$lib/utils/pdb';

	interface Props {
		chains: string[];
		chainRule: ChainRule;
		selected: string[];
		onChange: (selected: string[]) => void;
		chainInfo?: Record<string, ChainInfo>;
		accent?: string;
	}

	let { chains, chainRule, selected = $bindable(), onChange, chainInfo = {}, accent = '#6366f1' }: Props = $props();

	let copied = $state<string | null>(null);

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

	async function copySeq(e: MouseEvent, chain: string, seq: string) {
		e.stopPropagation();
		await navigator.clipboard.writeText(seq);
		copied = chain;
		setTimeout(() => { copied = null; }, 1500);
	}

	function formatSeq(seq: string): string {
		return seq.replace(/(.{10})/g, '$1 ').trimEnd();
	}
</script>

<div class="chain-list">
	{#each chains as chain (chain)}
		{@const info = chainInfo[chain]}
		{@const isSelected = selected.includes(chain)}
		{@const seq = info?.sequence ?? ''}
		<div
			class="chain-card"
			class:active={isSelected}
			style="--accent: {accent}"
			onclick={() => toggle(chain)}
			onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(chain); } }}
			role={chainRule.multiple ? 'checkbox' : 'radio'}
			aria-checked={isSelected}
			tabindex="0"
		>
			<div class="card-top">
				<div class="card-top-left">
					<span class="chain-letter">{chain}</span>
					{#if info?.length}
						<span class="chain-length">{info.length} aa</span>
					{/if}
					{#if info?.name}
						<span class="chain-name">{info.name}</span>
					{/if}
				</div>
				<div class="card-top-right">
					{#if seq}
						<button
							class="copy-btn"
							onclick={(e) => copySeq(e, chain, seq)}
							type="button"
							aria-label="Copy sequence"
						>
							{copied === chain ? 'Copied!' : 'Copy sequence'}
						</button>
					{/if}
					{#if isSelected}
						<span class="selected-pip" style="background: {accent}"></span>
					{/if}
				</div>
			</div>

			{#if seq}
				<span class="chain-seq">{formatSeq(seq)}</span>
			{/if}
		</div>
	{/each}
</div>

<span class="hint">{chainRule.multiple ? 'Multiple chains allowed' : 'Single chain'}</span>

<style>
	.chain-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.chain-card {
		width: 100%;
		background: var(--bg);
		border: 1.5px solid var(--border);
		border-radius: 0.625rem;
		padding: 0.75rem 0.875rem;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 0;
		box-sizing: border-box;
		user-select: none;
	}

	.chain-card:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.chain-card:hover:not(.active) {
		border-color: var(--text-muted);
	}

	.chain-card.active {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 8%, var(--bg));
	}

	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.card-top-left {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
		flex: 1;
	}

	.card-top-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.chain-letter {
		font-family: monospace;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text);
		line-height: 1;
		flex-shrink: 0;
	}

	.chain-length {
		font-size: 0.72rem;
		color: var(--text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.chain-name {
		font-size: 0.72rem;
		color: var(--text-muted);
		text-transform: capitalize;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chain-card.active .chain-length,
	.chain-card.active .chain-name {
		color: var(--text);
	}

	.copy-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 0.3rem;
		padding: 0.15rem 0.5rem;
		font-size: 0.7rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: border-color 0.15s, color 0.15s;
		white-space: nowrap;
	}

	.copy-btn:hover {
		border-color: var(--text-muted);
		color: var(--text);
	}

	.selected-pip {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.chain-seq {
		font-family: monospace;
		font-size: 0.68rem;
		color: var(--text-muted);
		letter-spacing: 0.04em;
		word-break: break-all;
		line-height: 1.7;
	}

	.chain-card.active .chain-seq {
		color: var(--text);
	}

	.hint {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
</style>
