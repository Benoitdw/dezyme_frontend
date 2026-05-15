export type ToolId = 'popmusic' | 'hotmusic' | 'snpmusic' | 'beatmusic' | 'soulmusic';

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
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
	placeholder?: string;
	hint?: string;
}

export interface ToolConfig {
	id: ToolId;
	name: string;
	tagline: string;
	accent: string;
	chainRule: ChainRule;
	fields: ToolField[];
	mutationList?: boolean;  // supports custom mutation selection (vs systematic all)
	description?: string;
	tags?: string[];
	doi?: string;
	bibTeX?: string;
	logoPath?: string;
	comingSoon?: boolean;
	legacyUrl?: string;
}
