/**
 * Module adapter interface and types for the Action Assistant.
 * Each adapter wraps an existing module endpoint.
 */

export interface AuthContext {
    userId: string;
    companyId: string;
    email: string;
    role: string;
    projectId?: string;  // Scopes wiki/RAG/DNA retrieval to a specific project
}

export interface AdapterResult {
    success: boolean;
    resultSummary: string;
    deepLink?: string;
    inlinePreview?: string;
    groundingStatus?: string;
    generatedId?: string;
    error?: string;
}

export interface ModuleAdapter {
    name: string;
    requiredParams: string[];
    optionalParams: string[];
    execute(params: Record<string, unknown>, auth: AuthContext): Promise<AdapterResult>;
}
