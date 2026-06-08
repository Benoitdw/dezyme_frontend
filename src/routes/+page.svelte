<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { toolList } from '$lib/tools';
	import { getRecentJobs, clearRecentJobs, removeJob } from '$lib/utils/storage';
	import type { StoredJob } from '$lib/utils/storage';

	let recentJobs: StoredJob[] = $state([]);

	onMount(() => {
		recentJobs = getRecentJobs();
	});
</script>

<!-- ── HERO ─────────────────────────────────────────── -->
<section class="hero">
	<div class="hero-glow" aria-hidden="true"></div>
	<div class="hero-inner">
		<h1>Mutation stability,<br />quantified.</h1>
		<p class="subtitle">
			Submit a protein structure, pick a tool, get quantitative predictions.
		</p>
		<a href="{base}/run" class="cta">Run an analysis <i class="fa-solid fa-arrow-right"></i></a>
	</div>
</section>

<!-- ── TOOLS ─────────────────────────────────────────── -->
<section class="tools-section">
	<div class="section-inner">
		<h2 class="section-title">Available tools</h2>
		<ul class="tool-list">
			{#each toolList as tool}
				<li>
					<a href="{base}/run?tool={tool.id}" class="tool-item" class:tool-coming={tool.comingSoon}>
						<div class="tool-accent-bar" style="background:{tool.accent}"></div>
						<div class="tool-body">
							<div class="tool-top">
								<span class="tool-name" style="color:{tool.accent}">{tool.name}</span>
								{#if tool.comingSoon}
									<span class="tool-badge">Coming soon</span>
								{/if}
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
						<span class="tool-arrow">{tool.comingSoon ? 'Preview →' : 'Run →'}</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>

<!-- ── RECENT JOBS ───────────────────────────────────── -->
{#if recentJobs.length > 0}
	<section class="recent-section">
		<div class="section-inner">
			<div class="recent-header">
				<h2 class="section-title">Recent analyses</h2>
				<button
					class="clear-btn"
					type="button"
					onclick={() => { clearRecentJobs(); recentJobs = []; }}
				>Clear</button>
			</div>
			<ul class="recent-list">
				{#each recentJobs as job}
					<li class="recent-item">
						<span class="recent-id">
							{#if job.structureId}
								<span class="recent-label">{job.structureId}{job.chains?.length ? ' · ' + job.chains.join(', ') : ''}</span>
								<span class="recent-uuid">{job.id}</span>
							{:else}
								{job.id}
							{/if}
						</span>
						<div class="recent-actions">
							<a href="{base}/results/{job.id}" class="recent-link">Open →</a>
							<button
								class="remove-btn"
								type="button"
								aria-label="Remove {job.id}"
								onclick={() => { removeJob(job.id); recentJobs = recentJobs.filter(j => j.id !== job.id); }}
							><i class="fa-solid fa-trash-can"></i></button>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<style>
	/* ── HERO ────────────────────────────────────────── */
	.hero {
		position: relative;
		padding: 7rem 2rem 5rem;
		text-align: center;
		overflow: hidden;
	}

	.hero-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 70% 55% at 50% 0%,
			color-mix(in srgb, #6366f1 14%, transparent),
			transparent 70%
		);
		pointer-events: none;
		animation: glow-pulse 5s ease-in-out infinite;
	}

	@keyframes glow-pulse {
		0%, 100% { opacity: 0.7; }
		50%       { opacity: 1; }
	}

	.hero-inner {
		position: relative;
		z-index: 1;
		max-width: 560px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
	}

	h1 {
		font-size: clamp(2.5rem, 5.5vw, 4.25rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1.1;
		color: var(--text);
	}

	.subtitle {
		font-size: 1.05rem;
		color: var(--text-muted);
		max-width: 420px;
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
	}

	.cta:hover {
		opacity: 0.88;
		transform: translateY(-1px);
	}

	/* ── TOOLS ───────────────────────────────────────── */
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

	.tool-name  { font-size: 1rem; font-weight: 700; }
	.tool-tags  { display: flex; gap: 0.4rem; }

	.tool-coming {
		opacity: 0.8;
	}

	.tool-badge {
		font-size: 0.65rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--text-muted) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--text-muted) 22%, transparent);
		border-radius: 0.25rem;
		padding: 0.1rem 0.5rem;
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

	/* ── RECENT ──────────────────────────────────────── */
	.recent-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}

	.recent-header .section-title {
		margin-bottom: 0;
	}

	.clear-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.25rem 0.75rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}

	.clear-btn:hover {
		color: #f87171;
		border-color: color-mix(in srgb, #f87171 40%, transparent);
	}

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

	.recent-id { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
	.recent-label { font-size: 0.9rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.recent-uuid { font-family: monospace; font-size: 0.75rem; color: var(--text-muted); }

	.recent-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.recent-link { color: var(--text); text-decoration: none; font-weight: 600; }
	.recent-link:hover { text-decoration: underline; }

	.remove-btn {
		background: none;
		border: none;
		padding: 0.2rem 0.3rem;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.78rem;
		opacity: 0.4;
		transition: color 0.15s, opacity 0.15s;
		line-height: 1;
	}

	.recent-item:hover .remove-btn { opacity: 1; }

	.remove-btn:hover { color: #f87171; }

</style>
