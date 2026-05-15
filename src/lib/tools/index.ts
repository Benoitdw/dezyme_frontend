import { popmusic } from './popmusic';
import { hotmusic } from './hotmusic';
import { snpmusic } from './snpmusic';
import { beatmusic } from './beatmusic';
import { soulmusic } from './soulmusic';
import type { ToolConfig, ToolId } from './types';

export const tools: Record<ToolId, ToolConfig> = { popmusic, hotmusic, snpmusic, beatmusic, soulmusic };
export const toolList: ToolConfig[] = [popmusic, hotmusic, snpmusic, beatmusic, soulmusic];
export type { ToolConfig, ToolId };
