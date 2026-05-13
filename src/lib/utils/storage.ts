import type { ToolId } from '$lib/tools/types';

export interface StoredJob {
	id: string;
	tool: ToolId;
	structureId: string;
}

const KEY = 'dezyme_jobs';
const MAX = 10;

function load(): StoredJob[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '[]');
	} catch {
		return [];
	}
}

function save(jobs: StoredJob[]) {
	localStorage.setItem(KEY, JSON.stringify(jobs));
}

export function addJob(job: StoredJob) {
	const jobs = load().filter((j) => j.id !== job.id);
	jobs.unshift(job);
	save(jobs.slice(0, MAX));
}

export function getRecentJobs(): StoredJob[] {
	return load();
}

export function parseToolFromId(analysisId: string): ToolId | null {
	const prefix = analysisId.split('_')[0] as ToolId;
	return ['popmusic', 'hotmusic', 'snpmusic'].includes(prefix) ? prefix : null;
}
