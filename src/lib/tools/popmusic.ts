import type { ToolConfig } from './types';

export const popmusic: ToolConfig = {
	id: 'popmusic',
	name: 'PopMuSiC',
	tagline: 'Predict the thermodynamic stability changes induced by single-site mutations',
	accent: '#6366f1',
	chainRule: {
		preselect: (chains) => chains.slice(0, 1),
		multiple: false
	},
	fields: []
};
