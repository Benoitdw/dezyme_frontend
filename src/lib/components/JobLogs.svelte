<script lang="ts">
	interface Props {
		content: string | null;
	}
	let { content }: Props = $props();

	const ANSI_COLORS: Record<string, string> = {
		'30': '#4a5568', '31': '#e53e3e', '32': '#38a169', '33': '#d69e2e',
		'34': '#3182ce', '35': '#805ad5', '36': '#319795', '37': '#a0aec0',
		'90': '#718096', '91': '#fc8181', '92': '#68d391', '93': '#f6e05e',
		'94': '#63b3ed', '95': '#b794f4', '96': '#4fd1c5', '97': '#f7fafc',
	};

	function ansiToHtml(text: string): string {
		let html = '';
		let bold = false;
		let color: string | null = null;
		const parts = text.split(/\x1b\[([0-9;]*)m/);
		for (let i = 0; i < parts.length; i++) {
			if (i % 2 === 0) {
				const escaped = parts[i]
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;');
				if (bold || color) {
					let style = '';
					if (bold) style += 'font-weight:700;';
					if (color) style += `color:${color};`;
					html += `<span style="${style}">${escaped}</span>`;
				} else {
					html += escaped;
				}
			} else {
				const codes = parts[i].split(';');
				for (const code of codes) {
					if (code === '0' || code === '') { bold = false; color = null; }
					else if (code === '1') bold = true;
					else if (ANSI_COLORS[code]) color = ANSI_COLORS[code];
				}
			}
		}
		return html;
	}
</script>

{#if content}
	<div class="log-card">
		<pre class="log-pre">{@html ansiToHtml(content)}</pre>
	</div>
{/if}

<style>
	.log-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		padding: 1.25rem;
		overflow-x: auto;
		max-height: 400px;
		overflow-y: auto;
	}
	.log-pre {
		font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 0.78rem;
		line-height: 1.6;
		color: var(--text);
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
