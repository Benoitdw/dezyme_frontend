export type ToolId = 'popmusic' | 'hotmusic' | 'snpmusic';

export interface ChainRule {
	preselect: (chains: string[]) => string[];
	multiple: boolean;
}

export interface ToolField {
	name: string;
	label: string;
	type: 'text' | 'number' | 'select' | 'checkbox';
	options?: { value: string; label: string }[];
	default?: string | number | boolean;
	required?: boolean;
}

export interface ToolConfig {
	id: ToolId;
	name: string;
	tagline: string;
	accent: string;
	chainRule: ChainRule;
	fields: ToolField[];
	description?: string;
	tags?: string[];
	doi?: string;
	bibTeX?: string;
	logoPath?: string;
}
