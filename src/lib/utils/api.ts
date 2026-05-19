import type { ToolId } from '$lib/tools/types';

export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface SubmitPayload {
	tool: ToolId;
	structureId: string;
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
	chains: string[];
	biologicalAssembly?: number;
	params: Record<string, unknown>;
	pdb?: { bytes: number };
	msa?: { filename: string; lines: number; bytes: number };
}

const API = '/api';

export async function submitAnalysis(payload: SubmitPayload): Promise<string> {
	const res = await fetch(`${API}/analysis`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const detail = await res.json().catch(() => ({ detail: res.statusText }));
		throw new Error(detail.detail ?? res.statusText);
	}
	const data = await res.json();
	return data.analysis_id;
}

export async function getJobStatus(analysisId: string): Promise<JobStatusResponse> {
	const res = await fetch(`${API}/analysis/${analysisId}/status`);
	if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
	return res.json();
}

export async function getJobPayload(analysisId: string): Promise<JobPayloadSummary | null> {
	const res = await fetch(`${API}/analysis/${analysisId}`);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Payload fetch failed: ${res.status}`);
	return res.json();
}
