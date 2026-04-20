/**
 * ═══════════════════════════════════════════════════════
 * Result Envelope Builder
 * ═══════════════════════════════════════════════════════
 *
 * Factory for creating and assembling ResultEnvelope objects
 * that represent the full output of a skill execution.
 */

import type {
    ResultEnvelope,
    ResponseMode,
    ArtifactRef,
    UIIntent,
    ExecutionMeta,
    DegradationReport,
    ExecutionTrace,
    ActionResult,
    Citation,
} from '../types';

/**
 * Create an empty ResultEnvelope with sensible defaults.
 */
export function createEnvelope(responseMode: ResponseMode = 'chat'): ResultEnvelope {
    return {
        responseMode,
        assistantMessage: undefined,
        artifacts: [],
        uiIntents: [],
        executionMeta: {
            durationMs: 0,
            modelUsed: '',
            tokensUsed: 0,
            toolCalls: 0,
            connectorCalls: 0,
            artifactsProduced: 0,
        },
        warnings: [],
        actionResults: [],
        citations: [],
        status: 'success',
    };
}

/**
 * Builder helper for constructing envelopes incrementally.
 */
export class EnvelopeBuilder {
    private envelope: ResultEnvelope;
    private startTime: number;

    constructor(responseMode: ResponseMode = 'chat') {
        this.envelope = createEnvelope(responseMode);
        this.startTime = Date.now();
    }

    setMessage(text: string): this {
        this.envelope.assistantMessage = text;
        return this;
    }

    addArtifact(artifact: ArtifactRef): this {
        this.envelope.artifacts.push(artifact);
        this.envelope.executionMeta.artifactsProduced++;
        return this;
    }

    addUIIntent(intent: UIIntent): this {
        this.envelope.uiIntents.push(intent);
        return this;
    }

    addWarning(warning: string): this {
        this.envelope.warnings.push(warning);
        return this;
    }

    addActionResult(result: ActionResult): this {
        this.envelope.actionResults.push(result);
        return this;
    }

    addCitation(citation: Citation): this {
        this.envelope.citations.push(citation);
        return this;
    }

    setModel(model: string): this {
        this.envelope.executionMeta.modelUsed = model;
        return this;
    }

    setTokens(count: number): this {
        this.envelope.executionMeta.tokensUsed = count;
        return this;
    }

    incrementToolCalls(): this {
        this.envelope.executionMeta.toolCalls++;
        return this;
    }

    incrementConnectorCalls(): this {
        this.envelope.executionMeta.connectorCalls++;
        return this;
    }

    setDegraded(report: DegradationReport): this {
        this.envelope.status = 'degraded';
        this.envelope.degradationReport = report;
        return this;
    }

    setFailed(reason: string): this {
        this.envelope.status = 'failed';
        this.envelope.warnings.push(reason);
        return this;
    }

    setTrace(trace: ExecutionTrace): this {
        this.envelope.executionTrace = trace;
        return this;
    }

    build(): ResultEnvelope {
        this.envelope.executionMeta.durationMs = Date.now() - this.startTime;
        return { ...this.envelope };
    }
}

/**
 * Create a simple text-only envelope (for backward-compatible content-generation results).
 */
export function createTextEnvelope(options: {
    message: string;
    model: string;
    durationMs: number;
}): ResultEnvelope {
    return {
        responseMode: 'chat',
        assistantMessage: options.message,
        artifacts: [],
        uiIntents: [],
        executionMeta: {
            durationMs: options.durationMs,
            modelUsed: options.model,
            tokensUsed: 0,
            toolCalls: 0,
            connectorCalls: 0,
            artifactsProduced: 0,
        },
        warnings: [],
        actionResults: [],
        citations: [],
        status: 'success',
    };
}
