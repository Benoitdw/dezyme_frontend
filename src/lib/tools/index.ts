import { popmusic } from './popmusic';
import { hotmusic } from './hotmusic';
import { snpmusic } from './snpmusic';
import type { ToolConfig, ToolId } from './types';

export const tools: Record<ToolId, ToolConfig> = { popmusic, hotmusic, snpmusic };
export const toolList: ToolConfig[] = [popmusic, hotmusic, snpmusic];
export type { ToolConfig, ToolId };
