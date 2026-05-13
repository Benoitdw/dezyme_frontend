import type { ToolId } from '$lib/tools/types';

export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface SubmitPayload {
	tool: ToolId;
	structureId: string;
	chains: string[];
	params: Record<string, unknown>;
}

export interface JobStatusResponse {
	analysis_id: string;
	status: JobStatus;
	error?: string;
}

const FAKE_DELAY = 1500;

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

// Fake job store — simulates backend state in memory
const fakeJobs: Record<string, { status: JobStatus; createdAt: number }> = {};

export async function submitAnalysis(payload: SubmitPayload): Promise<string> {
	await sleep(FAKE_DELAY);
	const id = `${payload.tool}_${Math.random().toString(36).slice(2, 9)}`;
	fakeJobs[id] = { status: 'pending', createdAt: Date.now() };

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
