import type { ToolConfig } from './types';

export const hotmusic: ToolConfig = {
	id: 'hotmusic',
	name: 'HoTMuSiC',
	tagline: 'Predict the effects of mutations on protein thermal stability',
	accent: '#f59e0b',
	chainRule: {
		preselect: (chains) => chains.slice(0, 1),
		multiple: false
	},
	fields: []
};
