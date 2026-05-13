export type InputType = 'pdb-id' | 'uniprot' | 'unknown';

export interface PdbMetadata {
	id: string;
	name: string;
	chains: string[];
	resolution?: string;
	organism?: string;
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

		return {
			id,
			name: data.struct?.title ?? id,
			chains: [...new Set(chains)].sort(),
			resolution: data.refine?.[0]?.ls_d_res_high?.toString(),
			organism: data.rcsb_entry_info?.source_organism_scientific_name
		};
	}

	if (type === 'uniprot') {
		const afId = `AF-${id}-F1`;
		return {
			id: afId,
			name: `AlphaFold model for ${id}`,
			chains: ['A'],
			organism: undefined,
			resolution: 'AlphaFold'
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

	return { id: 'custom', name, chains };
}
