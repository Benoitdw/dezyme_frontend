export type InputType = 'pdb-id' | 'uniprot' | 'unknown';

export interface PdbMetadata {
	id: string;
	name: string;
	chains: string[];
	resolution?: string;
	organism?: string;
	experimentType?: string;
	rFactor?: number;
	residueCount?: number;
	ligandCount?: number;
}

function fmtExperimentType(method?: string): string | undefined {
	if (!method) return undefined;
	const map: Record<string, string> = {
		'X-RAY DIFFRACTION':        'X-ray',
		'SOLUTION NMR':             'NMR',
		'SOLID-STATE NMR':          'Solid NMR',
		'ELECTRON MICROSCOPY':      'Cryo-EM',
		'ELECTRON CRYSTALLOGRAPHY': 'Electron crystallography',
		'NEUTRON DIFFRACTION':      'Neutron diffraction',
		'FIBER DIFFRACTION':        'Fiber diffraction',
		'POWDER DIFFRACTION':       'Powder diffraction',
	};
	return map[method.toUpperCase()] ?? method;
}

export function detectInputType(value: string): InputType {
	const v = value.trim().toUpperCase();
	if (/^[A-Z0-9]{4}$/.test(v)) return 'pdb-id';
	if (/^[OPQ][0-9][A-Z0-9]{3}[0-9]$|^[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}$/.test(v)) return 'uniprot';
	return 'unknown';
}

export async function fetchPdbMetadata(value: string, type: InputType): Promise<PdbMetadata> {
	const id = value.trim().toUpperCase();

	if (type === 'pdb-id') {
		const res = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${id}`);
		if (!res.ok) throw new Error(`PDB entry ${id} not found`);
		const data = await res.json();

		const entityIds: string[] = data.rcsb_entry_container_identifiers?.polymer_entity_ids ?? [];
		const entityResponses = await Promise.all(
			entityIds.map((eid: string) =>
				fetch(`https://data.rcsb.org/rest/v1/core/polymer_entity/${id}/${eid}`).then((r) =>
					r.ok ? r.json() : null
				)
			)
		);
		const chains: string[] = entityResponses.flatMap((e) =>
			e?.rcsb_polymer_entity_container_identifiers?.auth_asym_ids ?? []
		);

		const nonPolymerCount: number = data.rcsb_entry_info?.non_polymer_entity_count ?? 0;
		const solventCount: number    = data.rcsb_entry_info?.solvent_entity_count ?? 0;

		return {
			id,
			name: data.struct?.title ?? id,
			chains: [...new Set(chains)].sort(),
			resolution: data.refine?.[0]?.ls_d_res_high?.toString(),
			organism: data.rcsb_entry_info?.source_organism_scientific_name,
			experimentType: fmtExperimentType(data.exptl?.[0]?.method),
			rFactor:      data.refine?.[0]?.ls_R_factor_R_work ?? data.refine?.[0]?.ls_R_factor_obs,
			residueCount: data.rcsb_entry_info?.deposited_polymer_monomer_count,
			ligandCount:  Math.max(0, nonPolymerCount - solventCount),
		};
	}

	if (type === 'uniprot') {
		const afId = `AF-${id}-F1`;
		return {
			id: afId,
			name: `AlphaFold model for ${id}`,
			chains: ['A'],
			organism: undefined,
			experimentType: 'Predicted',
		};
	}

	throw new Error('Unknown input type');
}

export function parsePdbFile(content: string): PdbMetadata {
	const lines = content.split('\n');

	const chains = [...new Set(
		lines
			.filter((l) => l.startsWith('ATOM') || l.startsWith('HETATM'))
			.map((l) => l[21]?.trim())
			.filter(Boolean)
	)].sort() as string[];

	const titleLine = lines.find((l) => l.startsWith('TITLE'));
	const name = titleLine ? titleLine.slice(10).trim() : 'Uploaded structure';

	// R-factor from REMARK 3
	let rFactor: number | undefined;
	for (const l of lines) {
		const m = l.match(/^REMARK\s+3\s+R VALUE\s+\(WORKING SET\)\s*:\s*([0-9.]+)/);
		if (m) { rFactor = parseFloat(m[1]); break; }
	}

	// Count unique residues from ATOM records
	const residueKeys = new Set<string>();
	for (const l of lines) {
		if (!l.startsWith('ATOM')) continue;
		residueKeys.add(`${l[21]}${l.slice(22, 26).trim()}`);
	}

	// Count unique ligand instances from HETATM, excluding water
	const WATER = new Set(['HOH', 'WAT', 'H2O', 'DOD']);
	const ligandKeys = new Set<string>();
	for (const l of lines) {
		if (!l.startsWith('HETATM')) continue;
		const resName = l.slice(17, 20).trim();
		if (WATER.has(resName)) continue;
		ligandKeys.add(`${l[21]}${l.slice(22, 26).trim()}`);
	}

	return {
		id: 'custom',
		name,
		chains,
		rFactor,
		residueCount: residueKeys.size || undefined,
		ligandCount:  ligandKeys.size || undefined,
	};
}
