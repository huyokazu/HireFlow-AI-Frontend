// Điểm vào duy nhất của thư mục prompts/. Backend chỉ cần import từ đây.
import * as orchestrator from './orchestrator.js';
import * as cvExtraction from './cvExtraction.js';
import * as talentMatching from './talentMatching.js';
import * as selfHealing from './selfHealing.js';

export { PROMPT_VERSION, MASTER_SYSTEM_PROMPT, render, wrapData, buildSystem } from './shared.js';
export { orchestrator, cvExtraction, talentMatching, selfHealing };

/** Danh sách agent, dùng cho test và thống kê token. */
export const AGENTS = { orchestrator, cvExtraction, talentMatching, selfHealing };
