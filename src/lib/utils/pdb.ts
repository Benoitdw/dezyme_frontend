export type InputType = 'pdb-id' | 'uniprot' | 'unknown';

export interface ChainInfo {
	name?: string;
	length: number;
	sequence: string;  // full 1-letter sequence
}

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
	residues?: Record<string, string>;  // "A2" → "ALA" (chain+resNum → 3-letter AA)
	chainInfo?: Record<string, ChainInfo>;
	pdbContent?: string;  // raw PDB file content for LittleProtein
	msaUrl?: string;      // AlphaFold MSA download URL (versioned)
	biologicalAssemblyCount?: number;
}

// Standard + common modified residues found in PDB files
export const AA3TO1: Record<string, string> = {
	// Standard 20
	ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
	GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
	LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
	SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
	// Special / ambiguous
	SEC: 'U', PYL: 'O', ASX: 'B', GLX: 'Z', XLE: 'J', XAA: 'X',
	// Common modified — selenomethionine, hydroxyproline, phospho, etc.
	MSE: 'M', FME: 'M', CXM: 'M',
	HYP: 'P', DPR: 'P',
	TPO: 'T', SEP: 'S', PTR: 'Y',
	CSO: 'C', CME: 'C', CSS: 'C', CSD: 'C', OCS: 'C',
	MLY: 'K', M3L: 'K', ALY: 'K', LLP: 'K',
	HIP: 'H', HIE: 'H', HID: 'H', NEP: 'H',
	PCA: 'E', CGU: 'E',
	DAL: 'A', DGL: 'E', DGN: 'Q', DHI: 'H', DIL: 'I',
	DLE: 'L', DLY: 'K', DPN: 'F', DPR2: 'P', DSN: 'S',
	DTH: 'T', DTR: 'W', DTY: 'Y', DVA: 'V',
};

function parseResidueMap(atomLines: Iterable<string>): Record<string, string> {
	const map: Record<string, string> = {};
	for (const l of atomLines) {
		if (!l.startsWith('ATOM')) continue;
		const chain   = l[21]?.trim();
		const resNum  = l.slice(22, 26).trim();
		const resName = l.slice(17, 20).trim();
		if (!chain || !resNum || !resName) continue;
		const key = `${chain}${resNum}`;
		if (!map[key]) map[key] = resName;
	}
	return map;
}

// Returns chain → ordered list of 3-letter residue names from SEQRES records
function parseSeqres(lines: string[]): Record<string, string[]> {
	const byChain: Record<string, string[]> = {};
	for (const l of lines) {
		if (!l.startsWith('SEQRES')) continue;
		const chain = l[11]?.trim();
		if (!chain) continue;
		if (!byChain[chain]) byChain[chain] = [];
		// residues start at col 19, 4 chars each (3-letter + space), up to 13 per line
		for (let i = 19; i + 2 < l.length; i += 4) {
			const res = l.slice(i, i + 3).trim();
			if (res) byChain[chain].push(res);
		}
	}
	return byChain;
}

function buildChainInfo(
	residues: Record<string, string>,
	names: Record<string, string> = {},
	seqres: Record<string, string[]> = {}
): Record<string, ChainInfo> {
	// Build ATOM-based map as fallback
	const atomByChain: Record<string, Array<{ num: number; aa: string }>> = {};
	for (const [key, resName] of Object.entries(residues)) {
		const chain = key[0];
		const num = parseInt(key.slice(1), 10);
		if (!atomByChain[chain]) atomByChain[chain] = [];
		atomByChain[chain].push({ num, aa: AA3TO1[resName] ?? 'X' });
	}

	const allChains = new Set([...Object.keys(seqres), ...Object.keys(atomByChain)]);
	const result: Record<string, ChainInfo> = {};

	for (const chain of allChains) {
		const sr = seqres[chain];
		if (sr && sr.length > 0) {
			const sequence = sr.map((r) => AA3TO1[r] ?? 'X').join('');
			result[chain] = { name: names[chain], length: sr.length, sequence };
		} else {
			const entries = (atomByChain[chain] ?? []).sort((a, b) => a.num - b.num);
			result[chain] = {
				name: names[chain],
				length: entries.length,
				sequence: entries.map((r) => r.aa).join(''),
			};
		}
	}
	return result;
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
	if (/^[0-9][A-Z0-9]{3}$/.test(v)) return 'pdb-id';
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
		const assemblyIds: string[] = data.rcsb_entry_container_identifiers?.assembly_ids ?? [];
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

		// Map each chain to its entity description
		const chainNames: Record<string, string> = {};
		for (const e of entityResponses) {
			const desc: string | undefined = e?.rcsb_polymer_entity?.pdbx_description;
			if (!desc) continue;
			const ids: string[] = e?.rcsb_polymer_entity_container_identifiers?.auth_asym_ids ?? [];
			for (const cid of ids) chainNames[cid] = desc;
		}

		const nonPolymerCount: number = data.rcsb_entry_info?.non_polymer_entity_count ?? 0;
		const solventCount: number    = data.rcsb_entry_info?.solvent_entity_count ?? 0;

		let residues: Record<string, string> | undefined;
		let chainInfo: Record<string, ChainInfo> | undefined;
		let pdbContent: string | undefined;
		try {
			const pdbFile = await fetch(`https://files.rcsb.org/download/${id}.pdb`);
			if (pdbFile.ok) {
				pdbContent = await pdbFile.text();
				const lines = pdbContent.split('\n');
				residues = parseResidueMap(lines);
				chainInfo = buildChainInfo(residues, chainNames, parseSeqres(lines));
			}
		} catch { /* non-blocking */ }

		// Fallback: build chainInfo from names alone if residues unavailable
		if (!chainInfo && Object.keys(chainNames).length > 0) {
			chainInfo = Object.fromEntries(
				Object.entries(chainNames).map(([c, name]) => [c, { name, length: 0, sequence: '' }])
			);
		}

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
			residues,
			chainInfo,
			pdbContent,
			biologicalAssemblyCount: assemblyIds.length || undefined,
		};
	}

	if (type === 'uniprot') {
		const uniprotId = id;
		const afId = `AF-${uniprotId}-F1`;

		const apiRes = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${uniprotId}`);
		if (!apiRes.ok) throw new Error(`AlphaFold entry ${uniprotId} not found`);
		const afData = (await apiRes.json())[0];
		const pdbUrl: string = afData.pdbUrl;
		const msaUrl: string | undefined = afData.msaUrl;
		const organism: string | undefined = afData.organism ?? afData.scientificName;

		let pdbContent: string | undefined;
		let residues: Record<string, string> | undefined;
		let chainInfo: Record<string, ChainInfo> | undefined;
		try {
			const afFile = await fetch(pdbUrl);
			if (afFile.ok) {
				pdbContent = await afFile.text();
				const lines = pdbContent.split('\n');
				residues = parseResidueMap(lines);
				chainInfo = buildChainInfo(residues, {}, parseSeqres(lines));
			}
		} catch { /* non-blocking */ }

		return {
			id: afId,
			name: `AlphaFold model for ${uniprotId}`,
			chains: chainInfo ? Object.keys(chainInfo).sort() : ['A'],
			organism,
			experimentType: 'Predicted',
			residues,
			chainInfo,
			pdbContent,
			msaUrl,
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

	let rFactor: number | undefined;
	for (const l of lines) {
		const m = l.match(/^REMARK\s+3\s+R VALUE\s+\(WORKING SET\)\s*:\s*([0-9.]+)/);
		if (m) { rFactor = parseFloat(m[1]); break; }
	}

	const residueKeys = new Set<string>();
	for (const l of lines) {
		if (!l.startsWith('ATOM')) continue;
		residueKeys.add(`${l[21]}${l.slice(22, 26).trim()}`);
	}

	const WATER = new Set(['HOH', 'WAT', 'H2O', 'DOD']);
	const ligandKeys = new Set<string>();
	for (const l of lines) {
		if (!l.startsWith('HETATM')) continue;
		const resName = l.slice(17, 20).trim();
		if (WATER.has(resName)) continue;
		ligandKeys.add(`${l[21]}${l.slice(22, 26).trim()}`);
	}

	const residues = parseResidueMap(lines);
	const seqres   = parseSeqres(lines);

	return {
		id: 'custom',
		name,
		chains,
		rFactor,
		residueCount: residueKeys.size || undefined,
		ligandCount:  ligandKeys.size || undefined,
		residues,
		chainInfo: buildChainInfo(residues, {}, seqres),
		pdbContent: content,
	};
}
