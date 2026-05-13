<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { toolList } from '$lib/tools';
	import { getRecentJobs } from '$lib/utils/storage';
	import type { StoredJob } from '$lib/utils/storage';

	let recentJobs: StoredJob[] = $state([]);

	onMount(() => {
		recentJobs = getRecentJobs();
	});

	const exampleRows = [
		{ pos: 2,  wt: 'Leu', mut: 'Ala', ddg: +1.84, effect: 'destabilizing' },
		{ pos: 7,  wt: 'Val', mut: 'Ile', ddg: -0.31, effect: 'stabilizing'   },
		{ pos: 12, wt: 'Phe', mut: 'Tyr', ddg: -0.67, effect: 'stabilizing'   },
		{ pos: 18, wt: 'Lys', mut: 'Arg', ddg: -0.12, effect: 'neutral'       },
		{ pos: 23, wt: 'Gly', mut: 'Ala', ddg: +0.55, effect: 'destabilizing' },
		{ pos: 31, wt: 'Trp', mut: 'Phe', ddg: +2.10, effect: 'destabilizing' },
		{ pos: 34, wt: 'Ile', mut: 'Val', ddg: -0.44, effect: 'stabilizing'   },
		{ pos: 41, wt: 'Asp', mut: 'Asn', ddg: +0.78, effect: 'destabilizing' },
	];

	const ghostRows = [
		{ pos: 3,  wt: 'Ser', mut: 'Thr', ddg: -0.19 },
		{ pos: 9,  wt: 'Arg', mut: 'Lys', ddg: +0.33 },
		{ pos: 15, wt: 'Ala', mut: 'Gly', ddg: +1.02 },
		{ pos: 27, wt: 'Pro', mut: 'Ala', ddg: +1.55 },
		{ pos: 38, wt: 'Tyr', mut: 'His', ddg: -0.88 },
		{ pos: 44, wt: 'Met', mut: 'Leu', ddg: -0.23 },
	];
</script>

<!-- HERO -->
<section class="hero">
	<div class="glow" aria-hidden="true"></div>

	<div class="hero-inner">
		<div class="hero-text">
			<h1>Mutation stability,<br />quantified.</h1>
			<p class="subtitle">
				Submit a PDB structure, pick a tool, get quantitative predictions — ready to interpret.
			</p>
			<a href="{base}/run" class="cta">Run an analysis →</a>
		</div>

		<div class="preview-wrap" aria-hidden="true">
			<!-- ghost rows left -->
			<div class="ghost ghost-left">
				{#each ghostRows as row}
					<div class="ghost-row">
						<span class="ghost-pos">{row.pos}</span>
						<span class="ghost-mut">{row.wt} → {row.mut}</span>
						<span class="ghost-val" class:neg={row.ddg < 0}>{row.ddg > 0 ? '+' : ''}{row.ddg.toFixed(2)}</span>
					</div>
				{/each}
			</div>

			<!-- central card -->
			<div class="preview-card">
				<div class="card-header">
					<div class="card-id">
						<span class="pdb-badge">3BIO</span>
						<span class="chain-badge">Chain A</span>
					</div>
					<span class="tool-badge" style="--c: #6366f1">PopMuSiC</span>
				</div>

				<div class="card-label">ΔΔG predictions · single-site mutations</div>

				<table class="result-table">
					<thead>
						<tr>
							<th>Pos.</th>
							<th>Mutation</th>
							<th>ΔΔG (kcal/mol)</th>
							<th>Effect</th>
						</tr>
					</thead>
					<tbody>
						{#each exampleRows as row}
							<tr>
								<td class="mono">{row.pos}</td>
								<td class="mono">{row.wt} → {row.mut}</td>
								<td class="mono ddg" class:pos={row.ddg > 0.3} class:neg={row.ddg < -0.1}>
									{row.ddg > 0 ? '+' : ''}{row.ddg.toFixed(2)}
								</td>
								<td>
									<span class="tag {row.effect}">{row.effect}</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<div class="card-footer">
					<span class="example-note">Example output — 3BIO, 8 of 2,847 mutations shown</span>
				</div>
			</div>

			<!-- ghost rows right -->
			<div class="ghost ghost-right">
				{#each ghostRows.slice().reverse() as row}
					<div class="ghost-row">
						<span class="ghost-pos">{row.pos}</span>
						<span class="ghost-mut">{row.wt} → {row.mut}</span>
						<span class="ghost-val" class:neg={row.ddg < 0}>{row.ddg > 0 ? '+' : ''}{row.ddg.toFixed(2)}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</section>

<!-- TOOLS -->
<section class="tools-section">
	<div class="section-inner">
		<h2 class="section-title">Available tools</h2>
		<ul class="tool-list">
			{#each toolList as tool}
				<li>
					<a href="{base}/run?tool={tool.id}" class="tool-item">
						<div class="tool-accent-bar" style="background: {tool.accent}"></div>
						<div class="tool-body">
							<div class="tool-top">
								<span class="tool-name" style="color: {tool.accent}">{tool.name}</span>
								{#if tool.tags}
									<div class="tool-tags">
										{#each tool.tags.slice(0, 2) as tag}
											<span class="tool-tag">{tag}</span>
										{/each}
									</div>
								{/if}
							</div>
							<p class="tool-desc">{tool.tagline}</p>
						</div>
						<span class="tool-arrow">Run →</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>

<!-- RECENT JOBS -->
{#if recentJobs.length > 0}
	<section class="recent-section">
		<div class="section-inner">
			<h2 class="section-title">Recent analyses</h2>
			<ul class="recent-list">
				{#each recentJobs as job}
					<li class="recent-item">
						<span class="recent-id">{job.id}</span>
						<a href="{base}/results/{job.id}" class="recent-link">Open →</a>
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<style>
	/* ── HERO ─────────────────────────────────────────────────────────────── */
	.hero {
		position: relative;
		overflow: hidden;
		padding: 5rem 1.5rem 4rem;
		min-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse 60% 50% at 50% 10%, color-mix(in srgb, #6366f1 18%, transparent), transparent 70%);
		pointer-events: none;
	}

	.hero-inner {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3rem;
		width: 100%;
		max-width: 1100px;
		margin: 0 auto;
	}

	/* headline + CTA */
	.hero-text {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	h1 {
		font-size: clamp(2.25rem, 5vw, 3.75rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.1;
		color: var(--text);
	}

	.subtitle {
		font-size: 1.1rem;
		color: var(--text-muted);
		max-width: 480px;
		line-height: 1.6;
	}

	.cta {
		display: inline-block;
		background: #6366f1;
		color: #fff;
		font-weight: 700;
		font-size: 0.95rem;
		padding: 0.7rem 1.75rem;
		border-radius: 0.625rem;
		text-decoration: none;
		transition: opacity 0.15s, transform 0.15s;
		margin-top: 0.25rem;
	}

	.cta:hover {
		opacity: 0.88;
		transform: translateY(-1px);
	}

	/* preview layout */
	.preview-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		width: 100%;
	}

	/* central card */
	.preview-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 1.25rem;
		padding: 1.5rem;
		width: min(520px, 100%);
		flex-shrink: 0;
		box-shadow: 0 0 0 1px color-mix(in srgb, #6366f1 20%, transparent),
		            0 24px 64px rgba(0, 0, 0, 0.4);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.card-id {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.pdb-badge {
		font-family: monospace;
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--text);
		background: color-mix(in srgb, var(--text) 8%, transparent);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.2rem 0.55rem;
	}

	.chain-badge {
		font-size: 0.8rem;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 8%, transparent);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.2rem 0.55rem;
	}

	.tool-badge {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--c);
		background: color-mix(in srgb, var(--c) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
		border-radius: 0.375rem;
		padding: 0.2rem 0.55rem;
	}

	.card-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: 0.875rem;
	}

	.result-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
	}

	.result-table th {
		text-align: left;
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0 0.5rem 0.5rem;
		border-bottom: 1px solid var(--border);
	}

	.result-table td {
		padding: 0.45rem 0.5rem;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		color: var(--text);
	}

	.result-table tr:last-child td {
		border-bottom: none;
	}

	.mono {
		font-family: monospace;
	}

	.ddg { font-weight: 600; }
	.ddg.pos { color: #f87171; }
	.ddg.neg { color: #34d399; }

	.tag {
		font-size: 0.72rem;
		font-weight: 600;
		border-radius: 0.25rem;
		padding: 0.15rem 0.45rem;
	}

	.tag.destabilizing { background: color-mix(in srgb, #f87171 12%, transparent); color: #f87171; }
	.tag.stabilizing   { background: color-mix(in srgb, #34d399 12%, transparent); color: #34d399; }
	.tag.neutral       { background: color-mix(in srgb, #94a3b8 12%, transparent); color: #94a3b8; }

	.card-footer {
		margin-top: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.example-note {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	/* ghost columns */
	.ghost {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		flex: 1;
		max-width: 220px;
		padding: 0 1.25rem;
	}

	.ghost-left { align-items: flex-end; }
	.ghost-right { align-items: flex-start; }

	.ghost-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.35rem 0.6rem;
		font-size: 0.78rem;
		opacity: 0.35;
		white-space: nowrap;
	}

	.ghost-left .ghost-row:nth-child(odd)  { opacity: 0.20; }
	.ghost-right .ghost-row:nth-child(even) { opacity: 0.20; }

	.ghost-pos  { font-family: monospace; color: var(--text-muted); min-width: 1.5rem; }
	.ghost-mut  { font-family: monospace; color: var(--text); }
	.ghost-val  { font-family: monospace; font-weight: 600; color: #f87171; margin-left: auto; }
	.ghost-val.neg { color: #34d399; }

	@media (max-width: 700px) {
		.ghost { display: none; }
	}

	/* ── TOOLS ────────────────────────────────────────────────────────────── */
	.tools-section,
	.recent-section {
		padding: 3rem 1.5rem;
		border-top: 1px solid var(--border);
	}

	.section-inner {
		max-width: 700px;
		margin: 0 auto;
	}

	.section-title {
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin-bottom: 1.25rem;
	}

	.tool-list {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tool-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		padding: 1.25rem 1.25rem 1.25rem 0;
		text-decoration: none;
		color: var(--text);
		transition: border-color 0.15s, transform 0.15s;
	}

	.tool-item:hover {
		border-color: color-mix(in srgb, var(--text-muted) 50%, transparent);
		transform: translateY(-1px);
	}

	.tool-accent-bar {
		width: 3px;
		align-self: stretch;
		border-radius: 0 2px 2px 0;
		flex-shrink: 0;
	}

	.tool-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.tool-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.tool-name {
		font-size: 1rem;
		font-weight: 700;
	}

	.tool-tags {
		display: flex;
		gap: 0.4rem;
	}

	.tool-tag {
		font-size: 0.7rem;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--text-muted) 20%, transparent);
		border-radius: 0.25rem;
		padding: 0.1rem 0.45rem;
	}

	.tool-desc {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.tool-arrow {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-muted);
		flex-shrink: 0;
		padding-right: 0.25rem;
	}

	/* ── RECENT ───────────────────────────────────────────────────────────── */
	.recent-list {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.recent-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.6rem 1rem;
		font-size: 0.875rem;
	}

	.recent-id {
		font-family: monospace;
		color: var(--text-muted);
	}

	.recent-link {
		color: var(--text);
		text-decoration: none;
		font-weight: 600;
	}

	.recent-link:hover {
		text-decoration: underline;
	}
</style>
