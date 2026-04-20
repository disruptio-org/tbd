/* ═══════════════════════════════════════════════════════
   Centralized Permission Catalog
   ═══════════════════════════════════════════════════════
   Single source of truth for all feature keys, sub-feature
   keys, access levels, and human-readable labels used by
   the access group system and feature guards.
   ═══════════════════════════════════════════════════════ */

// ─── Access Levels ─────────────────────────────────────

export type AccessLevel = 'VIEW' | 'USE' | 'MANAGE';

export const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
    { value: 'VIEW', label: 'View' },
    { value: 'USE', label: 'Use' },
    { value: 'MANAGE', label: 'Manage' },
];

// ─── Resource Types ────────────────────────────────────

export type ResourceType = 'FEATURE' | 'SUB_FEATURE' | 'PROJECT_SCOPE';

// ─── Top-Level Feature Keys ───────────────────────────

export const FEATURE_KEYS = [
    'dashboard',
    'documents',
    'chat',
    'company_advisor',
    'search',
    'marketing',
    'sales',
    'product_assistant',
    'leads',
    'crm',
    'tasks',
    'projects_workspaces',
    'classifications',
    'knowledge_gaps',
    'ai_brain',
    'onboarding_assistant',
    'settings',
    'user_management',
    'access_groups',
    'action_assistant',
    'integrations',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

// ─── Sub-Feature Keys ─────────────────────────────────

export const SUB_FEATURE_KEYS = [
    // Documents
    'documents.upload',
    'documents.delete',
    'documents.manage_folders',
    'documents.run_ocr',
    // Marketing
    'marketing.generate',
    // Sales
    'sales.generate',
    // Product
    'product.generate',
    // Leads
    'leads.generate',
    // Tasks
    'tasks.create',
    'tasks.edit',
    // Projects
    'projects.create',
    'projects.edit',
    'projects.delete',
    // Settings areas
    'settings.company_profile',
    'settings.knowledge_admin',
    'settings.user_management',
    'settings.access_groups',
    'settings.ai_brain',
] as const;

export type SubFeatureKey = (typeof SUB_FEATURE_KEYS)[number];

// ─── Human-Readable Labels ────────────────────────────

export const FEATURE_LABELS: Record<string, string> = {
    // Top-level features
    dashboard: 'Dashboard',
    documents: 'Documents',
    chat: 'Ask AI',
    company_advisor: 'Company Advisor',
    search: 'Search',
    marketing: 'Marketing Assistant',
    sales: 'Sales Assistant',
    product_assistant: 'Product Assistant',
    leads: 'Lead Discovery',
    crm: 'CRM',
    tasks: 'Tasks',
    projects_workspaces: 'Projects & Workspaces',
    classifications: 'Data Extraction',
    knowledge_gaps: 'Knowledge Insights',
    settings: 'Settings',
    user_management: 'User Management',
    access_groups: 'Access Groups',
    action_assistant: 'Action Assistant',
    ai_brain: 'AI Team',
    onboarding_assistant: 'Onboarding Guide',
    integrations: 'Integrations',
    // Sub-features
    'documents.upload': 'Upload Documents',
    'documents.delete': 'Delete Documents',
    'documents.manage_folders': 'Manage Folders',
    'documents.run_ocr': 'Run OCR',
    'marketing.generate': 'Generate Marketing Content',
    'sales.generate': 'Generate Sales Content',
    'product.generate': 'Generate Product Output',
    'leads.generate': 'Generate Leads',
    'projects.create': 'Create Projects',
    'projects.edit': 'Edit Projects',
    'projects.delete': 'Delete Projects',
    'settings.company_profile': 'Company Profile Settings',
    'settings.knowledge_admin': 'Knowledge Administration',
    'settings.user_management': 'User Management Settings',
    'settings.access_groups': 'Access Group Settings',
    'settings.ai_brain': 'AI Team Settings',
    // Tasks
    'tasks.create': 'Create Tasks',
    'tasks.edit': 'Edit Tasks',
};

// ─── Feature Groups (for UI organization) ─────────────

export interface FeatureGroup {
    key: string;
    label: string;
    features: FeatureKey[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
    {
        key: 'core',
        label: 'Core',
        features: ['dashboard', 'chat', 'company_advisor', 'search', 'action_assistant'],
    },
    {
        key: 'knowledge',
        label: 'Knowledge',
        features: ['documents', 'classifications', 'knowledge_gaps'],
    },
    {
        key: 'growth',
        label: 'Growth',
        features: ['marketing', 'sales', 'product_assistant', 'leads', 'crm', 'onboarding_assistant'],
    },
    {
        key: 'execution',
        label: 'Execution',
        features: ['tasks', 'projects_workspaces'],
    },
    {
        key: 'admin',
        label: 'Administration',
        features: ['settings', 'ai_brain', 'user_management', 'access_groups', 'integrations'],
    },
];

// ─── Sub-Feature Groups (parent → sub-feature keys) ───

export const SUB_FEATURE_GROUPS: Record<string, SubFeatureKey[]> = {
    documents: ['documents.upload', 'documents.delete', 'documents.manage_folders', 'documents.run_ocr'],
    marketing: ['marketing.generate'],
    sales: ['sales.generate'],
    product_assistant: ['product.generate'],
    leads: ['leads.generate'],
    tasks: ['tasks.create', 'tasks.edit'],
    projects_workspaces: ['projects.create', 'projects.edit', 'projects.delete'],
    settings: ['settings.company_profile', 'settings.knowledge_admin', 'settings.user_management', 'settings.access_groups', 'settings.ai_brain'],
};

// ─── System Role Baselines ────────────────────────────

export type SystemRole = 'MEMBER' | 'ADMIN' | 'SUPER_ADMIN';

/** Baseline permissions for MEMBER (minimal — requires group grants) */
export const MEMBER_BASELINE: FeatureKey[] = [
    'dashboard',
    'chat',
];

/** Baseline permissions for ADMIN (full company access) */
export const ADMIN_BASELINE: FeatureKey[] = [...FEATURE_KEYS] as FeatureKey[];

/** User status enum */
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

// ─── Effective Access Shape ───────────────────────────

export interface EffectiveAccess {
    role: SystemRole;
    status: UserStatus;
    features: Record<string, boolean>;
    subFeatures: Record<string, boolean>;
    scopes: {
        projects: {
            mode: 'all' | 'selected';
            ids: string[];
        };
    };
}

/** Build a default EffectiveAccess for a given role */
export function buildBaselineAccess(role: SystemRole, status: UserStatus): EffectiveAccess {
    const baseline = role === 'SUPER_ADMIN' || role === 'ADMIN'
        ? ADMIN_BASELINE
        : MEMBER_BASELINE;

    const features: Record<string, boolean> = {};
    for (const key of FEATURE_KEYS) {
        features[key] = baseline.includes(key);
    }

    const subFeatures: Record<string, boolean> = {};
    for (const key of SUB_FEATURE_KEYS) {
        // ADMIN/SUPER_ADMIN: all sub-features enabled by default
        // MEMBER: all sub-features disabled by default (need group grants)
        subFeatures[key] = role === 'ADMIN' || role === 'SUPER_ADMIN';
    }

    return {
        role,
        status,
        features,
        subFeatures,
        scopes: {
            projects: { mode: 'all', ids: [] },
        },
    };
}
