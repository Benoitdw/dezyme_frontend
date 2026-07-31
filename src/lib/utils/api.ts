import type { ToolId } from '$lib/tools/types';

export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface SubmitPayload {
	tool: ToolId;
	structureId: string;
	pdbFilename?: string;
	chains: string[];
	biologicalAssembly?: number;
	pdbContent?: string;
	msaContent?: string;
	msaFilename?: string;
	params: Record<string, unknown>;
}

export interface JobStatusResponse {
	analysis_id: string;
	status: JobStatus;
	error?: string;
}

export interface JobPayloadSummary {
	tool: ToolId;
	structureId: string;
	pdbFilename?: string;
	chains: string[];
	biologicalAssembly?: number;
	params: Record<string, unknown>;
	pdb?: { bytes: number };
	msa?: { filename: string; lines: number; bytes: number };
}

export interface PopMusicResultUrls {
	mutations_csv: string | null;
	multiple_mutations_csv: string | null;
	pdb: string | null;
	fasta: string | null;
	metadata_json: string | null;
}

export interface HotMusicResultUrls {
	hot: string | null;
	hots: string | null;
	pdb: string | null;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const API = `${BASE}/api`;

export async function submitAnalysis(payload: SubmitPayload): Promise<string> {
	const res = await fetch(`${API}/analysis`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		if (res.status === 413) {
			throw new Error('Your input is too large to be processed. Please contact us if you need to analyse unusually large structures.');
		}
		const detail = await res.json().catch(() => ({ detail: res.statusText }));
		throw new Error(detail.detail ?? res.statusText);
	}
	const data = await res.json();
	return data.analysis_id;
}

export async function getJobStatus(analysisId: string): Promise<JobStatusResponse | null> {
	const res = await fetch(`${API}/analysis/${analysisId}/status`);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
	return res.json();
}

export async function getJobPayload(analysisId: string): Promise<JobPayloadSummary | null> {
	const res = await fetch(`${API}/analysis/${analysisId}`);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Payload fetch failed: ${res.status}`);
	return res.json();
}

export async function getJobLogs(analysisId: string): Promise<string | null> {
	const res = await fetch(`${API}/analysis/${analysisId}/logs`);
	if (!res.ok) return null;
	return res.text();
}

export async function getJobResultUrls(analysisId: string): Promise<PopMusicResultUrls | null> {
	const res = await fetch(`${API}/analysis/${analysisId}/results`);
	if (!res.ok) return null;
	const data = await res.json().catch(() => null);
	if (!data) return null;
	const prefix = (path: string | null) => (path ? `${BASE}${path}` : null);
	return {
		mutations_csv:  prefix(data.mutations_csv),
		multiple_mutations_csv: prefix(data.multiple_mutations_csv),
		pdb:            prefix(data.pdb),
		fasta:          prefix(data.fasta),
		metadata_json:  prefix(data.metadata_json),
	};
}

export async function getHotmusicResultUrls(analysisId: string): Promise<HotMusicResultUrls | null> {
	const res = await fetch(`${API}/analysis/${analysisId}/results`);
	if (!res.ok) return null;
	const data = await res.json().catch(() => null);
	if (!data) return null;
	const prefix = (path: string | null) => (path ? `${BASE}${path}` : null);
	return {
		hot:  prefix(data.hot),
		hots: prefix(data.hots),
		pdb:  prefix(data.pdb),
	};
}

export async function fetchOutputFileText(url: string): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
	return res.text();
}

export function getDownloadUrl(analysisId: string): string {
	return `${API}/analysis/${analysisId}/download`;
}
