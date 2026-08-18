import { parseMutationsCSV, parseMultipleMutationsCSV } from '$lib/utils/popmusic';
import { base } from '$app/paths';

export async function load({ fetch }) {
	const prefix = `${base}/examples/popmusic/popmusicevol`;

	const [mutCsvText, multiCsvText, metadataText, logText] = await Promise.all([
		fetch(`${prefix}/input_A_mutations.csv`).then((r) => r.text()),
		fetch(`${prefix}/input_A_multiple_mutations.csv`).then((r) => (r.ok ? r.text() : null)).catch(() => null),
		fetch(`${prefix}/input_A_metadata.json`).then((r) => r.text()),
		fetch(`${prefix}/input_A_logs.txt`).then((r) => (r.ok ? r.text() : null)).catch(() => null)
	]);

	const metadata = JSON.parse(metadataText);

	return {
		mutations: parseMutationsCSV(mutCsvText),
		multipleMutations: multiCsvText ? parseMultipleMutationsCSV(multiCsvText) : [],
		pdbUrl: `${prefix}/input.pdb`,
		fastaContent: null,
		// Only fetched if the visitor opens the Parameters tab
		fastaUrl: `${prefix}/input_A.a3m`,
		downloads: [
			{ label: 'Mutations CSV',          url: `${prefix}/input_A_mutations.csv` },
			...(multiCsvText ? [{ label: 'Multiple mutations CSV', url: `${prefix}/input_A_multiple_mutations.csv` }] : []),
			{ label: 'Metadata JSON',          url: `${prefix}/input_A_metadata.json` },
			{ label: 'MSA',                    url: `${prefix}/input_A.a3m` },
			{ label: 'Structure PDB',          url: `${prefix}/input.pdb` }
		],
		zipUrl: null,
		lambda: metadata.struct_vs_evol_models_lambda ?? 1,
		msaNtot: metadata.msa_Ntot ?? null,
		sigSlope:      metadata.struct_vs_evol_models_sigmoid_slope  ?? null,
		sigCenter:     metadata.struct_vs_evol_models_sigmoid_center ?? null,
		clipThreshold: metadata.struct_vs_evol_models_clip_threshold ?? null,
		logContent: logText
	};
}
