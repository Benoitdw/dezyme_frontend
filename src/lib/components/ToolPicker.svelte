<script lang="ts">
	import { base } from '$app/paths';
	import { tools } from '$lib/tools';
	import type { ToolId } from '$lib/tools';
	import { fly } from 'svelte/transition';

	type Choice = { label: string; sublabel: string; next: string };
	type QuestionNode = { type: 'question'; text: string; choices: Choice[] };
	type ResultNode   = { type: 'result'; toolId: ToolId };
	type Node = QuestionNode | ResultNode;

	const tree: Record<string, Node> = {
		root: {
			type: 'question',
			text: 'What do you want to predict?',
			choices: [
				{
					label: 'Protein stability upon mutation',
					sublabel: 'How a mutation affects folding energy or melting temperature',
					next: 'stability'
				},
				{
					label: 'Disease-causing potential of a variant',
					sublabel: 'Pathogenicity of a missense SNP in a human protein',
					next: 'snpmusic'
				},
				{
					label: 'Protein–protein binding affinity',
					sublabel: 'Effect of a mutation at a protein complex interface',
					next: 'beatmusic'
				},
				{
					label: 'Solubility or aggregation propensity',
					sublabel: 'Whether a mutation promotes or suppresses aggregation',
					next: 'soulmusic'
				},
			]
		},
		stability: {
			type: 'question',
			text: 'Which type of stability?',
			choices: [
				{
					label: 'Thermodynamic stability',
					sublabel: 'Folding free energy change ΔΔG (kcal/mol) — how tightly the protein folds at a given temperature',
					next: 'popmusic'
				},
				{
					label: 'Thermal stability',
					sublabel: 'Melting temperature shift ΔTm (K) — at what temperature the protein unfolds',
					next: 'hotmusic'
				},
			]
		},
		popmusic:  { type: 'result', toolId: 'popmusic'  },
		hotmusic:  { type: 'result', toolId: 'hotmusic'  },
		snpmusic:  { type: 'result', toolId: 'snpmusic'  },
		beatmusic: { type: 'result', toolId: 'beatmusic' },
		soulmusic: { type: 'result', toolId: 'soulmusic' },
	};

	type Step = { key: string; chosenLabel: string | null };

	let history = $state<Step[]>([{ key: 'root', chosenLabel: null }]);

	let currentKey  = $derived(history[history.length - 1].key);
	let current     = $derived(tree[currentKey]);
	let breadcrumb  = $derived(history.slice(0, -1).filter(s => s.chosenLabel));

	function pick(next: string, label: string) {
		history = [...history, { key: next, chosenLabel: label }];
	}

	function back() {
		if (history.length > 1) history = history.slice(0, -1);
	}

	function reset() {
		history = [{ key: 'root', chosenLabel: null }];
	}
</script>

<div class="picker">
	<!-- Breadcrumb trail -->
	{#if breadcrumb.length > 0}
		<div class="breadcrumb">
			{#each breadcrumb as step, i}
				{#if i > 0}<span class="sep">›</span>{/if}
				<span class="crumb">{step.chosenLabel}</span>
			{/each}
		</div>
	{/if}

	<!-- Animated panel -->
	{#key currentKey}
		<div class="panel" in:fly={{ y: 14, duration: 220, delay: 30 }}>

			{#if current.type === 'question'}
				<p class="question-text">{current.text}</p>
				<div class="choices" class:two={current.choices.length === 2}>
					{#each current.choices as choice}
						<button
							class="choice-card"
							onclick={() => pick(choice.next, choice.label)}
							type="button"
						>
							<span class="choice-label">{choice.label}</span>
							<span class="choice-sub">{choice.sublabel}</span>
						</button>
					{/each}
				</div>

			{:else}
				{@const tool = tools[current.toolId]}
				<div class="result-card" style="--c: {tool.accent}">
					<div class="result-header">
						<span class="result-name" style="color: {tool.accent}">{tool.name}</span>
						{#if tool.comingSoon}
							<span class="result-badge">Coming soon</span>
						{/if}
					</div>
					<p class="result-desc">{tool.description}</p>
					{#if tool.tags}
						<div class="result-tags">
							{#each tool.tags as tag}
								<span class="result-tag">{tag}</span>
							{/each}
						</div>
					{/if}
					<div class="result-actions">
						{#if tool.comingSoon}
							{#if tool.legacyUrl}
								<a
									href={tool.legacyUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="result-legacy"
									style="--c: {tool.accent}"
								>Use previous version →</a>
							{:else}
								<span class="result-unavailable">Not yet available</span>
							{/if}
						{:else}
							<a
								href="{base}/run?tool={tool.id}"
								class="result-run"
								style="background: {tool.accent}"
							>Run {tool.name} →</a>
						{/if}
					</div>
				</div>
			{/if}

		</div>
	{/key}

	<!-- Navigation -->
	<div class="nav">
		{#if history.length > 1}
			<button class="nav-btn" onclick={back} type="button">← Back</button>
		{/if}
		{#if history.length > 1}
			<button class="nav-btn nav-reset" onclick={reset} type="button">Start over</button>
		{/if}
	</div>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* ── Breadcrumb ── */
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		min-height: 1.25rem;
	}

	.crumb {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.sep {
		font-size: 0.75rem;
		color: var(--border);
	}

	/* ── Panel ── */
	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.question-text {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
		line-height: 1.5;
	}

	/* ── Choice cards ── */
	.choices {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.6rem;
	}

	.choices.two {
		grid-template-columns: 1fr 1fr;
	}

	.choice-card {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		text-align: left;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 0.9rem 1.1rem;
		cursor: pointer;
		transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
	}

	.choice-card:hover {
		border-color: color-mix(in srgb, var(--text-muted) 50%, transparent);
		transform: translateY(-1px);
		box-shadow: 0 4px 16px color-mix(in srgb, var(--text) 5%, transparent);
	}

	.choice-label {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text);
	}

	.choice-sub {
		font-size: 0.78rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	/* ── Result card ── */
	.result-card {
		background: color-mix(in srgb, var(--c) 5%, var(--surface));
		border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
		border-radius: 0.875rem;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.result-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.result-name {
		font-size: 1.3rem;
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.result-badge {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--text-muted) 22%, transparent);
		border-radius: 0.25rem;
		padding: 0.15rem 0.5rem;
	}

	.result-desc {
		font-size: 0.875rem;
		color: var(--text-muted);
		line-height: 1.65;
	}

	.result-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.result-tag {
		font-size: 0.7rem;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--text-muted) 20%, transparent);
		border-radius: 0.25rem;
		padding: 0.1rem 0.45rem;
	}

	.result-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding-top: 0.25rem;
	}

	.result-run {
		display: inline-block;
		color: #fff;
		font-weight: 700;
		font-size: 0.875rem;
		padding: 0.55rem 1.25rem;
		border-radius: 0.5rem;
		text-decoration: none;
		transition: opacity 0.15s, transform 0.15s;
	}

	.result-run:hover {
		opacity: 0.88;
		transform: translateY(-1px);
	}

	.result-legacy {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--c);
		text-decoration: none;
	}

	.result-legacy:hover {
		text-decoration: underline;
	}

	.result-unavailable {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	/* ── Navigation ── */
	.nav {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-height: 1.5rem;
	}

	.nav-btn {
		background: none;
		border: none;
		padding: 0;
		font-size: 0.8rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.15s;
	}

	.nav-btn:hover {
		color: var(--text);
	}

	.nav-reset {
		margin-left: auto;
	}

	/* ── Mobile ── */
	@media (max-width: 560px) {
		.choices.two {
			grid-template-columns: 1fr;
		}
	}
</style>
