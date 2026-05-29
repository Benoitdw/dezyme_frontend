import { parseMutationsCSV } from '$lib/utils/popmusic';
import { base } from '$app/paths';

export type { EvolMutationRow } from '$lib/utils/popmusic';

export async function load({ fetch }) {
	const prefix = `${base}/examples/popmusic/popmusicevol`;
	const name = '6acv_A_29-94';

	const [mutCsvText, fastaText, lambdaText, logText] = await Promise.all([
		fetch(`${prefix}/${name}_A_mutations.csv`).then((r) => r.text()),
		fetch(`${prefix}/${name}.fasta`).then((r) => r.text()),
		fetch(`${prefix}/lambda`).then((r) => r.text()),
		fetch(`${prefix}/job.log`).then((r) => (r.ok ? r.text() : null)).catch(() => null)
	]);

	return {
		mutations: parseMutationsCSV(mutCsvText),
		pdbUrl: `${prefix}/${name}.pdb`,
		fastaContent: fastaText,
		zipUrl: `${prefix}/output.zip`,
		lambda: Math.min(1, Math.max(0, parseFloat(lambdaText.trim()))),
		logContent: logText
	};
}
