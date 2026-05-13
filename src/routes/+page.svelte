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
</script>

<div class="page">
	<section class="hero">
		<h1>Protein mutation<br />analysis tools</h1>
		<p class="subtitle">
			Submit your structure, choose your tool, get quantitative predictions.
		</p>
	</section>

	<section class="tools">
		{#each toolList as tool}
			<a href="{base}/run?tool={tool.id}" class="tool-card" style="--accent: {tool.accent}">
				<div class="tool-name">{tool.name}</div>
				<p class="tool-tagline">{tool.tagline}</p>
				<span class="launch">Launch →</span>
			</a>
		{/each}
	</section>

	{#if recentJobs.length > 0}
		<section class="recent">
			<h2>Recent analyses</h2>
			<ul>
				{#each recentJobs as job}
					<li>
						<span class="job-id">{job.id}</span>
						<a href="{base}/results/{job.id}" class="open-link">Open →</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.page {
		max-width: 900px;
		margin: 0 auto;
		padding: 4rem 2rem;
	}

	.hero {
		text-align: center;
		margin-bottom: 4rem;
	}

	h1 {
		font-size: clamp(2rem, 5vw, 3.5rem);
		font-weight: 800;
		letter-spacing: -0.03em;
		line-height: 1.1;
		color: var(--text);
		margin-bottom: 1rem;
	}

	.subtitle {
		font-size: 1.125rem;
		color: var(--text-muted);
		max-width: 480px;
		margin: 0 auto;
	}

	.tools {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.25rem;
		margin-bottom: 4rem;
	}

	.tool-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 1rem;
		padding: 1.75rem;
		text-decoration: none;
		color: var(--text);
		transition: border-color 0.15s, transform 0.15s;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tool-card:hover {
		border-color: var(--accent);
		transform: translateY(-2px);
	}

	.tool-name {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--accent);
	}

	.tool-tagline {
		font-size: 0.875rem;
		color: var(--text-muted);
		flex: 1;
		line-height: 1.5;
	}

	.launch {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--accent);
		margin-top: 0.5rem;
	}

	.recent h2 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.recent ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.recent li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.6rem 1rem;
		font-size: 0.875rem;
	}

	.job-id {
		font-family: monospace;
		color: var(--text-muted);
	}

	.open-link {
		color: var(--text);
		text-decoration: none;
		font-weight: 600;
	}

	.open-link:hover {
		text-decoration: underline;
	}
</style>
