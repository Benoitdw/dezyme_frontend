<script lang="ts">
	interface Props {
		accept: string;        // e.g. ".fasta,.a3m" or ".pdb"
		label?: string;
		hint?: string;
		onFile: (content: string, filename: string) => void;
	}

	let { accept, label = 'Drop file here', hint = 'or browse', onFile }: Props = $props();

	let dragging = $state(false);

	function read(file: File) {
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			onFile(content, file.name);
		};
		reader.readAsText(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) read(file);
	}

	function handleInput(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) read(file);
	}
</script>

<label
	class="dropzone"
	class:dragging
	ondragover={(e) => { e.preventDefault(); dragging = true; }}
	ondragleave={() => { dragging = false; }}
	ondrop={handleDrop}
>
	<input type="file" {accept} onchange={handleInput} class="file-input" />
	<span class="drop-label">{label}</span>
	<span class="drop-hint">or <u>{hint}</u></span>
</label>

<style>
	.dropzone {
		border: 2px dashed var(--border);
		border-radius: 0.75rem;
		padding: 1.5rem;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.dropzone:hover,
	.dropzone.dragging {
		border-color: var(--text-muted);
		background: var(--surface);
	}

	.file-input {
		display: none;
	}

	.drop-label {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.drop-hint {
		font-size: 0.78rem;
		color: var(--text-muted);
	}
</style>
