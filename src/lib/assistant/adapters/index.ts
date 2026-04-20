/**
 * Barrel file for all module adapters.
 * V2: Direct adapters + routing adapters. Content adapters remain for AI Team Member chats.
 */

// ── Direct action adapters (used by global assistant) ──
export { tasksAdapter } from './tasks';
export { navigationAdapter } from './navigation';
export { initiativeAdapter } from './initiative';

// ── Routing adapters (V2) ──
export { handoffAdapter } from './handoff';
export { workspaceAdapter } from './workspace';

// ── Content adapters (used by AI Team Member chats, NOT the global assistant) ──
export { marketingAdapter } from './marketing';
export { salesAdapter } from './sales';
export { productAdapter } from './product';
export { leadsAdapter } from './leads';
export { designAdapter } from './design';
export { knowledgeAdapter } from './knowledge';

// ── Types ──
export type { ModuleAdapter, AuthContext, AdapterResult } from './types';
