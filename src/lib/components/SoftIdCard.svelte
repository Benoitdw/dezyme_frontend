<script lang="ts">
	import type { ToolConfig } from '$lib/tools/types';

	let { tool }: { tool: ToolConfig } = $props();

	let copied = $state(false);

	function copyBib() {
		if (!tool.bibTeX) return;
		navigator.clipboard.writeText(tool.bibTeX).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}

	function onImgError(e: Event) {
		(e.currentTarget as HTMLImageElement).src = '/logos/default.svg';
	}
</script>

<div class="card">
	<div class="logo-wrap">
		<img
			src={tool.logoPath ?? '/logos/default.svg'}
			alt="{tool.name} logo"
			class="logo"
			onerror={onImgError}
		/>
	</div>

	<div class="info">
		{#if tool.description}
			<p class="description">{tool.description}</p>
		{/if}

		{#if tool.tags && tool.tags.length > 0}
			<div class="tags">
				{#each tool.tags as tag}
					<span class="tag" style="--accent: {tool.accent}">{tag}</span>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if tool.doi}
				<a
					class="doi"
					href="https://doi.org/{tool.doi}"
					target="_blank"
					rel="noopener noreferrer"
					title="Open publication"
				>
					DOI: {tool.doi}
				</a>
			{/if}

			{#if tool.bibTeX}
				<button class="copy-bib" onclick={copyBib} type="button">
					{#if copied}
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
						Copied!
					{:else}
						<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
							<rect x="5" y="1" width="9" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
							<path d="M11 4H3a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 3 16h8a1.5 1.5 0 0 0 1.5-1.5V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
						Copy .bib reference
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.card {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1.25rem;
	}

	.logo-wrap {
		flex-shrink: 0;
		width: 100px;
		height: 100px;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--surface);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.logo {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		min-width: 0;
	}

	.description {
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.55;
		margin: 0;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.tag {
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		color: var(--accent);
		letter-spacing: 0.01em;
	}

	.footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.doi {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-decoration: none;
		white-space: nowrap;
	}

	.doi:hover {
		text-decoration: underline;
		color: var(--text);
	}

	.copy-bib {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: none;
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		padding: 0.3rem 0.65rem;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}

	.copy-bib:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}
</style>
