export type InputType = 'pdb-id' | 'uniprot' | 'unknown';

export interface ChainInfo {
	name?: string;
	length: number;
	sequence: string;  // full 1-letter sequence
}

// Chain id → number of copies of that chain in a structure or biological unit
export type ChainCopies = Record<string, number>;

export interface PdbMetadata {
	id: string;
	name: string;
	pdbFilename?: string;  // original filename with extension (e.g. AF-P12345-F1-model_v4.pdb, 4HTC.pdb)
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
	assemblies?: Record<number, ChainCopies>;  // biological unit index → composition (REMARK 350)
	assemblyIndex?: number;                    // set when pdbContent holds a biological unit
	chainCopies?: ChainCopies;                 // composition of what pdbContent actually holds
}

// Composition of every biological unit, read from the REMARK 350 records of the
// asymmetric unit file: each BIOMOLECULE applies a set of BIOMT transformations
// (one per generated copy) to a list of chains.
export function parseBiologicalAssemblies(content: string): Record<number, ChainCopies> {
	const assemblies: Record<number, ChainCopies> = {};
	let unit: number | null = null;
	let groupChains: string[] = [];
	let transforms = 0;

	const flushGroup = () => {
		if (unit === null || groupChains.length === 0) return;
		const composition = (assemblies[unit] ??= {});
		for (const chain of groupChains) {
			composition[chain] = (composition[chain] ?? 0) + Math.max(transforms, 1);
		}
	};

	for (const line of content.split('\n')) {
		if (!line.startsWith('REMARK 350')) continue;
		const body = line.slice(10).trim();

		const biomolecule = body.match(/^BIOMOLECULE:\s*(\d+)/);
		if (biomolecule) {
			flushGroup();
			unit = parseInt(biomolecule[1], 10);
			groupChains = [];
			transforms = 0;
			continue;
		}
		if (unit === null) continue;

		// A unit may apply distinct transformation sets to distinct chain groups
		const apply = body.match(/^APPLY THE FOLLOWING TO CHAINS:\s*(.+)$/);
		if (apply) {
			flushGroup();
			groupChains = apply[1].split(/[,\s]+/).filter(Boolean);
			transforms = 0;
			continue;
		}
		// Continuation line of the chain list of the current group
		const and = body.match(/^AND CHAINS:\s*(.+)$/);
		if (and) {
			groupChains = [...groupChains, ...and[1].split(/[,\s]+/).filter(Boolean)];
			continue;
		}
		if (body.startsWith('BIOMT1')) transforms += 1;
	}
	flushGroup();
	return assemblies;
}

// Chains actually present in a PDB file, with their number of copies. Biological
// unit files store the symmetry copies as separate MODELs, hence countModels —
// for the other multi-model files (NMR ensembles) every model is the same chain.
export function parseChainCopies(content: string, countModels = false): ChainCopies {
	const seen = new Set<string>();
	let model = 0;
	for (const line of content.split('\n')) {
		if (line.startsWith('MODEL ')) { model += 1; continue; }
		if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) continue;
		const chain = line[21]?.trim();
		if (!chain) continue;
		seen.add(countModels ? `${model}:${chain}` : chain);
	}
	const copies: ChainCopies = {};
	for (const key of seen) {
		const chain = countModels ? key.slice(key.indexOf(':') + 1) : key;
		copies[chain] = (copies[chain] ?? 0) + 1;
	}
	return copies;
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

// 'A₂B₂' — compact stoichiometry of a unit, or a plain count when too long to read
export function formatStoichiometry(copies: ChainCopies): string {
	const chains = Object.keys(copies).sort();
	if (chains.length === 0) return '';
	if (chains.length > 6) {
		const total = chains.reduce((sum, c) => sum + copies[c], 0);
		return `${chains.length} chains, ${total} copies`;
	}
	return chains
		.map((chain) => {
			const n = copies[chain];
			if (n <= 1) return chain;
			const sub = String(n).split('').map((d) => SUBSCRIPT_DIGITS[Number(d)]).join('');
			return chain + sub;
		})
		.join('');
}

// Index of the biological unit an uploaded file holds, from its extension (.pdb1, .pdb2, …)
function assemblyIndexFromFilename(filename?: string): number | undefined {
	const m = filename?.match(/\.pdb(\d+)$/i);
	return m ? parseInt(m[1], 10) : undefined;
}

// Standard 20 + ambiguous + full non-standard AA map from 3BioCompBio/StructureDCA
export const AA3TO1: Record<string, string> = {
	// Standard 20
	ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
	GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
	LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
	SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
	// Ambiguous / special
	SEC: 'U', PYL: 'O', ASX: 'B', GLX: 'Z', XLE: 'J', XAA: 'X',
	// Non-standard AAs (HETATM in PDB) — mapped to closest standard AA
	'00C': 'C', '02K': 'A', '02Y': 'A', '03Y': 'C', '05N': 'P', '05O': 'Y',
	'07O': 'C', '0A1': 'Y', '0A8': 'C', '0A9': 'F', '0AF': 'W', '0AH': 'S',
	'0AK': 'D', '0AR': 'R', '0BN': 'F', '0CS': 'A', '0E5': 'T', '0EA': 'Y',
	'0FL': 'A', '0LF': 'P', '0QL': 'C', '0TD': 'D', '0WZ': 'Y', '0Y8': 'P',
	'11Q': 'P', '143': 'C', '1AC': 'A', '1OP': 'Y', '1PA': 'F', '1TQ': 'W',
	'1TY': 'Y', '1X6': 'S', '23F': 'F', '23P': 'A', '2CO': 'C', '2GX': 'F',
	'2HF': 'H', '2JG': 'S', '2KK': 'K', '2KP': 'K', '2LT': 'Y', '2ML': 'L',
	'2MR': 'R', '2MT': 'P', '2RA': 'A', '2RX': 'S', '2SO': 'H', '2TL': 'T',
	'2TY': 'Y', '2ZC': 'S', '30V': 'C', '31Q': 'C', '33X': 'A', '34E': 'V',
	'3AH': 'H', '3BY': 'P', '3CF': 'F', '3CT': 'Y', '3GL': 'E', '3MY': 'Y',
	'3PX': 'P', '3QN': 'K', '3WX': 'P', '3X9': 'C', '3YM': 'Y', '3ZH': 'H',
	'41H': 'F', '41Q': 'N', '432': 'S', '4AF': 'F', '4AK': 'K', '4AR': 'R',
	'4AW': 'W', '4CF': 'F', '4CY': 'M', '4D4': 'R', '4DP': 'W', '4FB': 'P',
	'4FW': 'W', '4GJ': 'C', '4HH': 'S', '4HJ': 'S', '4HL': 'Y', '4HT': 'W',
	'4II': 'F', '4IN': 'W', '4J4': 'C', '4J5': 'R', '4KY': 'P', '4L0': 'P',
	'4LZ': 'Y', '4N7': 'P', '4N8': 'P', '4N9': 'P', '4OG': 'W', '4OU': 'F',
	'4OV': 'S', '4PH': 'F', '4PQ': 'W', '4WQ': 'A', '51T': 'Y', '54C': 'W',
	'55I': 'F', '5CS': 'C', '5CT': 'K', '5CW': 'W', '5GM': 'I', '5MW': 'K',
	'5OW': 'K', '5PG': 'G', '5R5': 'S', '5T3': 'K', '5VV': 'N', '5XU': 'A',
	'60F': 'C', '66D': 'I', '6CL': 'K', '6CV': 'A', '6CW': 'W', '6DN': 'K',
	'6M6': 'C', '6V1': 'C', '6WK': 'C', '73C': 'S', '73N': 'R', '73O': 'Y',
	'73P': 'K', '74P': 'K', '7ID': 'D', '7N8': 'F', '7O5': 'A', '7OZ': 'A',
	'7XC': 'F', '823': 'N', '86N': 'E', '8JB': 'C', '8LJ': 'P', '8RE': 'K',
	'9E7': 'K', '9KP': 'K',
	AA4: 'A', AAR: 'R', ABA: 'A', ACB: 'D', AEA: 'C', AEI: 'T', AGM: 'R',
	AGQ: 'Y', AGT: 'C', AHB: 'N', AHO: 'A', AHP: 'A', AIB: 'A', ALC: 'A',
	ALN: 'A', ALO: 'T', ALS: 'A', ALT: 'A', ALY: 'K', AN6: 'L', API: 'K',
	APK: 'K', ARM: 'R', ARO: 'R', ASA: 'D', ASB: 'D', ASL: 'D', AYA: 'A',
	AZH: 'A', AZK: 'K',
	B27: 'T', B2A: 'A', B2F: 'F', B2I: 'I', B2V: 'V', B3A: 'A', B3D: 'D',
	B3E: 'E', B3K: 'K', B3S: 'S', B3X: 'N', B3Y: 'Y', BB6: 'C', BB7: 'C',
	BB8: 'F', BB9: 'C', BBC: 'C', BCX: 'C', BCS: 'C', BFD: 'D', BG1: 'S',
	BHD: 'D', BH2: 'D', BIF: 'F', BLE: 'L', BMT: 'T', BOR: 'R', BP5: 'A',
	BPE: 'C', BTK: 'K', BTR: 'W', BUC: 'C', BWV: 'R', BXT: 'S', BYR: 'Y',
	C1X: 'K', C3Y: 'C', C4R: 'C', C5C: 'C', C6C: 'C', CAF: 'C', CAS: 'C',
	CCS: 'C', CE7: 'N', CG6: 'C', CGU: 'E', CGV: 'C', CHP: 'G', CIR: 'R',
	CLG: 'K', CLH: 'K', CML: 'C', CME: 'C', CMH: 'C', CMT: 'C', CR5: 'G',
	CS1: 'C', CS3: 'C', CS4: 'C', CSA: 'C', CSB: 'C', CSD: 'C', CSJ: 'C',
	CSO: 'C', CSP: 'C', CSR: 'C', CSS: 'C', CSU: 'C', CSX: 'C', CSZ: 'C',
	CTH: 'T', CWR: 'S', CXM: 'M', CY0: 'C', CY1: 'C', CY3: 'C', CY4: 'C',
	CYD: 'C', CYF: 'C', CYG: 'C', CYJ: 'K', CYQ: 'C', CYR: 'C', CYW: 'C',
	CZ2: 'C', CZS: 'A', CZZ: 'C',
	D11: 'T', D2T: 'D', D3P: 'G', DA2: 'R', DAB: 'A', DAH: 'F', DAL: 'A',
	DAR: 'R', DAS: 'D', DBB: 'T', DBU: 'T', DBY: 'Y', DBZ: 'A', DCY: 'C',
	DDE: 'H', DDZ: 'A', DGL: 'E', DGN: 'Q', DHA: 'S', DHI: 'H', DHV: 'V',
	DI7: 'Y', DIL: 'I', DIV: 'V', DJD: 'F', DLE: 'L', DLS: 'K', DLY: 'K',
	DM0: 'K', DMH: 'N', DMK: 'D', DNE: 'L', DNP: 'A', DNW: 'A', DPN: 'F',
	DPL: 'P', DPP: 'A', DPQ: 'Y', DPR: 'P', DSE: 'S', DSG: 'N', DSN: 'S',
	DTH: 'T', DTR: 'W', DTY: 'Y', DV9: 'E', DVA: 'V', DYA: 'D', DYJ: 'P',
	DYS: 'C',
	E9C: 'Y', E9M: 'W', E9V: 'H', ECC: 'Q', ECX: 'C', EFC: 'C', EI4: 'R',
	EJA: 'C', ELY: 'K', EME: 'E', ESB: 'Y', ESC: 'M', EXA: 'K', EXL: 'W',
	F2F: 'F', F2Y: 'Y', F7W: 'W', FAK: 'K', FC0: 'F', FCL: 'F', FDL: 'K',
	FF9: 'K', FGA: 'E', FGL: 'G', FGP: 'S', FH7: 'K', FHO: 'K', FHL: 'K',
	FIO: 'R', FL6: 'D', FLT: 'Y', FME: 'M', FOE: 'C', FP9: 'P', FQA: 'K',
	FTR: 'W', FTY: 'Y', FVA: 'V', FY2: 'Y', FY3: 'Y', FZN: 'K',
	G1X: 'Y', G5G: 'L', GFT: 'S', GGL: 'E', GHP: 'G', GHG: 'Q', GL3: 'G',
	GLJ: 'E', GLZ: 'G', GME: 'E', GMA: 'E', GNC: 'Q', GPL: 'K', GVL: 'S',
	H14: 'F', H5M: 'P', H7V: 'A', HIA: 'H', HIC: 'H', HID: 'H', HIE: 'H',
	HIQ: 'H', HIP: 'H', HL2: 'L', HLU: 'L', HLY: 'K', HMR: 'R', HNC: 'C',
	HOO: 'H', HOX: 'F', HP9: 'F', HPE: 'F', HQA: 'A', HR7: 'R', HRG: 'R',
	HS8: 'H', HS9: 'H', HSE: 'S', HSK: 'H', HSL: 'S', HSV: 'H', HT7: 'W',
	HTI: 'C', HTN: 'N', HTR: 'W', HVA: 'V', HY3: 'P', HYP: 'P', HZP: 'P',
	I2M: 'I', I3D: 'W', I4G: 'G', I7F: 'S', IAM: 'A', IAS: 'D', IB9: 'Y',
	IC0: 'G', ICY: 'C', IGL: 'G', IIL: 'I', ILM: 'I', ILX: 'I', IML: 'I',
	IPG: 'G', IYR: 'Y', IZO: 'M',
	J2F: 'Y', JJJ: 'C', JJK: 'C', JJL: 'C', JKH: 'P', JLP: 'K',
	K5H: 'C', K5L: 'S', K7K: 'S', KBE: 'K', KCR: 'K', KCX: 'K', KFP: 'K',
	KGC: 'K', KHB: 'K', KKD: 'D', KOR: 'M', KPI: 'K', KPF: 'K', KPY: 'K',
	KST: 'K', KYN: 'W', KYQ: 'K',
	L3O: 'L', L5P: 'K', LA2: 'K', LAL: 'A', LAY: 'L', LBZ: 'K', LCK: 'K',
	LDH: 'K', LE1: 'V', LED: 'L', LEF: 'L', LEI: 'V', LEN: 'L', LET: 'K',
	LGY: 'K', LLP: 'K', LLO: 'K', LLY: 'K', LME: 'E', LMQ: 'Q', LP6: 'K',
	LPD: 'P', LRK: 'K', LSO: 'K', LTU: 'W', LVN: 'V', LYF: 'K', LYN: 'K',
	LYO: 'K', LYR: 'K', LYX: 'K', LYZ: 'K',
	M0H: 'C', M2L: 'K', M2S: 'M', M3L: 'K', MAA: 'A', MBQ: 'Y', MCS: 'C',
	MDF: 'Y', ME0: 'M', MEA: 'F', MED: 'M', MEN: 'N', MH6: 'S', MHL: 'L',
	MHO: 'M', MHU: 'F', MHS: 'H', MIR: 'S', MIS: 'S', MK8: 'L', ML3: 'K',
	MLE: 'L', MLY: 'K', MLZ: 'K', MLL: 'L', MND: 'N', MNL: 'L', MPQ: 'G',
	MSA: 'G', MSE: 'M', MSO: 'M', MTY: 'Y', MVA: 'V', MYK: 'K', MYN: 'R',
	N0A: 'F', N10: 'S', N65: 'K', N80: 'P', N9P: 'A', NA8: 'A', NAL: 'A',
	NBQ: 'Y', NC1: 'S', NCB: 'A', NEP: 'H', NFA: 'F', NIY: 'Y', NLE: 'L',
	NLB: 'L', NLN: 'L', NLO: 'L', NLW: 'L', NLY: 'G', NMC: 'G', NMM: 'R',
	NPH: 'C', NVA: 'V', NYB: 'C', NYS: 'C', NZC: 'T', NZH: 'H',
	O6H: 'W', O7D: 'W', O7G: 'V', OAS: 'S', OBS: 'K', OCY: 'C', OCS: 'C',
	OHI: 'H', OHS: 'D', OLD: 'H', OLT: 'T', OMH: 'S', OMT: 'M', OMX: 'Y',
	OMY: 'Y', ORN: 'A', ORQ: 'R', OSE: 'S', OTH: 'T', OXX: 'D', OYL: 'H',
	OZW: 'F',
	P1L: 'C', P2Q: 'Y', P3Q: 'Y', P9S: 'C', PAQ: 'Y', PAT: 'W', PBF: 'F',
	PCA: 'Q', PEC: 'C', PF5: 'F', PFF: 'F', PG9: 'G', PH6: 'P', PHA: 'F',
	PHD: 'D', PHI: 'F', PHL: 'F', PLJ: 'P', PM3: 'F', POK: 'R', POM: 'P',
	PPN: 'F', PR3: 'C', PR4: 'P', PR7: 'P', PR9: 'P', PRJ: 'P', PRK: 'K',
	PRV: 'G', PRS: 'P', PSH: 'H', PTH: 'Y', PTM: 'Y', PTR: 'Y', PXU: 'P',
	PYA: 'A', PYX: 'C',
	Q2E: 'W', Q3P: 'K', Q75: 'M', Q78: 'F', QCI: 'Q', QCS: 'C', QIL: 'I',
	QM8: 'A', QMB: 'A', QMM: 'Q', QPA: 'C', QPH: 'F', QVA: 'C', QX7: 'A',
	R1A: 'C', R4K: 'W', RE0: 'W', RE3: 'W', RGL: 'R', RPI: 'R', RVJ: 'A',
	RVX: 'S', RX9: 'I', RXL: 'V',
	S1H: 'S', SAC: 'S', SAR: 'G', SBL: 'S', SCH: 'C', SCY: 'C', SCS: 'C',
	SDP: 'S', SEB: 'S', SEE: 'S', SEL: 'S', SEN: 'S', SEP: 'S', SET: 'S',
	SGB: 'S', SLL: 'K', SLZ: 'K', SMC: 'C', SME: 'M', SMF: 'F', SNC: 'C',
	SNN: 'N', SNK: 'H', SRZ: 'S', SVA: 'S', SVV: 'S', SVX: 'S', SVY: 'S',
	SVZ: 'S', SUN: 'S', SXE: 'S',
	T0I: 'Y', T8L: 'T', T9E: 'T', TBG: 'V', TCQ: 'Y', TDD: 'L', TFW: 'W',
	TGH: 'W', TH5: 'T', TH6: 'T', THC: 'T', TIH: 'A', TIS: 'S', TLY: 'K',
	TMD: 'T', TNQ: 'W', TOQ: 'W', TOX: 'W', TPL: 'W', TPO: 'T', TPQ: 'Y',
	TQQ: 'W', TQZ: 'C', TRF: 'W', TRN: 'W', TRO: 'W', TRQ: 'W', TRW: 'W',
	TRX: 'W', TS9: 'I', TSQ: 'F', TSY: 'C', TTQ: 'W', TY2: 'Y', TY5: 'Y',
	TY8: 'Y', TYB: 'Y', TYE: 'Y', TYI: 'Y', TYJ: 'Y', TYN: 'Y', TYO: 'Y',
	TYQ: 'Y', TYS: 'Y', TYT: 'Y', TYY: 'Y',
	U2X: 'Y', U3X: 'F', UF0: 'S', UMA: 'A', UXQ: 'F',
	V44: 'C', V61: 'F', V7T: 'K', VAD: 'V', VHF: 'E', VI3: 'C', VPV: 'K',
	VR0: 'R',
	WFP: 'F', WLU: 'L', WPA: 'F', WRP: 'W', WVL: 'V',
	X: 'X', XA6: 'F', XCN: 'C', XPR: 'P', XSN: 'N', XW1: 'A', XYC: 'A',
	XX1: 'K',
	Y1V: 'L', Y57: 'K', YCM: 'C', YHA: 'K', YOF: 'Y', YPZ: 'Y', YTF: 'Q',
	YTH: 'T',
	Z3E: 'T', ZAL: 'A', ZBZ: 'C', ZCL: 'F', ZDJ: 'Y', ZYJ: 'P', ZYK: 'P',
	ZZJ: 'A',
};

function parseResidueMap(atomLines: Iterable<string>): Record<string, string> {
	const map: Record<string, string> = {};
	for (const l of atomLines) {
		const isAtom   = l.startsWith('ATOM');
		const isHetatm = !isAtom && l.startsWith('HETATM');
		if (!isAtom && !isHetatm) continue;
		const chain   = l[21]?.trim();
		const resNum  = l.slice(22, 26).trim();
		const resName = l.slice(17, 20).trim();
		if (!chain || !resNum || !resName) continue;
		// For HETATM, only include residues known to be non-standard AAs
		if (isHetatm && !(resName in AA3TO1)) continue;
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
		let assemblies: Record<number, ChainCopies> | undefined;
		let chainCopies: ChainCopies | undefined;
		try {
			const pdbFile = await fetch(`https://files.rcsb.org/download/${id}.pdb`);
			if (pdbFile.ok) {
				pdbContent = await pdbFile.text();
				const lines = pdbContent.split('\n');
				residues = parseResidueMap(lines);
				chainInfo = buildChainInfo(residues, chainNames, parseSeqres(lines));
				assemblies = parseBiologicalAssemblies(pdbContent);
				chainCopies = parseChainCopies(pdbContent);
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
			pdbFilename: `${id}.pdb`,
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
			assemblies,
			chainCopies,
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
			pdbFilename: pdbUrl.split('/').pop() ?? `${afId}.pdb`,
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

export function parsePdbFile(content: string, filename?: string): PdbMetadata {
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
	const assemblyIndex = assemblyIndexFromFilename(filename);

	return {
		id: 'custom',
		name,
		pdbFilename: filename,
		chains,
		rFactor,
		residueCount: residueKeys.size || undefined,
		ligandCount:  ligandKeys.size || undefined,
		residues,
		chainInfo: buildChainInfo(residues, {}, seqres),
		pdbContent: content,
		assemblyIndex,
		chainCopies: parseChainCopies(content, assemblyIndex !== undefined),
	};
}
