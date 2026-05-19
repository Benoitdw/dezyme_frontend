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

const FAKE_DELAY = 1500;

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

interface FakeJob {
	status: JobStatus;
	createdAt: number;
	payloadSummary: JobPayloadSummary;
}

// Fake job store — simulates backend state in memory
const fakeJobs: Record<string, FakeJob> = {};

export async function submitAnalysis(payload: SubmitPayload): Promise<string> {
	await sleep(FAKE_DELAY);
	const id = `${payload.tool}_${Math.random().toString(36).slice(2, 9)}`;

	const payloadSummary: JobPayloadSummary = {
		tool: payload.tool,
		structureId: payload.structureId,
		chains: payload.chains,
		biologicalAssembly: payload.biologicalAssembly,
		params: payload.params,
		pdb: payload.pdbContent
			? { bytes: new TextEncoder().encode(payload.pdbContent).length }
			: undefined,
		msa: payload.msaContent && payload.msaFilename
			? {
				filename: payload.msaFilename,
				lines: payload.msaContent.split('\n').length,
				bytes: new TextEncoder().encode(payload.msaContent).length,
			}
			: undefined,
	};

	fakeJobs[id] = { status: 'pending', createdAt: Date.now(), payloadSummary };

	// Simulate progression
	setTimeout(() => { if (fakeJobs[id]) fakeJobs[id].status = 'running'; }, 3000);
	setTimeout(() => { if (fakeJobs[id]) fakeJobs[id].status = 'done'; }, 8000);

	return id;
}

export async function getJobStatus(analysisId: string): Promise<JobStatusResponse> {
	await sleep(300);
	const job = fakeJobs[analysisId];
	if (!job) return { analysis_id: analysisId, status: 'pending' };
	return { analysis_id: analysisId, status: job.status };
}

export function getJobPayload(analysisId: string): JobPayloadSummary | null {
	return fakeJobs[analysisId]?.payloadSummary ?? null;
}
