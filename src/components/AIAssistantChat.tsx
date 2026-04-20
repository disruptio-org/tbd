'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ProjectWorkspace } from '@/components/WorkspaceSelector';
import { useWhisper } from '@/lib/useWhisper';
import {
    Settings, Sparkles, ClipboardCopy, Eye, RefreshCw, Square, CheckCircle2,
    FileText, Paperclip, CircleCheck, AlertTriangle, Send,
    Save, Download, Mic, X, ChevronDown, ChevronUp, User,
    ThumbsUp, ThumbsDown, Zap, ArrowRight, Loader, Share2,
    Mail, MessageCircle, Briefcase, ExternalLink, FileDown,
    Maximize2, Minimize2, Archive,
} from 'lucide-react';
import JSZip from 'jszip';
import './AIAssistantChat.css';
import { ArtifactBubble, type BubbleState, type ArtifactMeta } from '@/components/artifacts/ArtifactBubble';
import { ArtifactViewer } from '@/components/artifacts/ArtifactViewer';
import { RuntimeResultRenderer } from '@/components/skills/RuntimeResultRenderer';
import type { ResultEnvelope } from '@/lib/skills/types';

/* ─── Types ──────────────────────────────────────────── */

export interface ContentType {
    value: string;
    label: string;
    icon: React.ReactNode;
    outputActions?: string[];
    // Runtime metadata
    importMode?: string;
    runtimeCategory?: string;
    responseMode?: string;
    compatibilityState?: string;
}

export interface GenerationResult {
    generationRunId: string;
    title: string;
    content: string;
    contentStructured?: Record<string, string>;
    summary?: string;
    // Runtime extensions
    resultEnvelope?: ResultEnvelope;
    artifacts?: unknown[];
    responseMode?: string;
    executionMeta?: unknown;
    [key: string]: unknown;
}

interface Attachment {
    id: string;       // local id
    name: string;
    type: 'file' | 'doc';
    docId?: string;   // for workspace docs
    file?: File;      // for uploaded files
    preview?: string; // base64 for images
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    isParams?: boolean;
    attachments?: Attachment[];
    resultEnvelope?: ResultEnvelope;
}

interface DocumentOption { id: string; filename: string; size: number; }

interface AIAssistantChatProps {
    assistantType: 'MARKETING' | 'SALES' | 'PRODUCT' | 'ONBOARDING' | 'COMPANY_ADVISOR' | 'GENERAL_AI' | (string & {});
    contentTypes: ContentType[];
    workspace: ProjectWorkspace | null;
    generating: boolean;
    result: GenerationResult | null;
    sectionOrder: [string, string][];
    onGenerate: (params: Record<string, unknown>) => void;
    onRefine: (action: string, previousOutput: string) => void;
    onSave: () => void;
    onCopy: (text: string) => void;
    onExport: (content: string, title: string) => void;
    onExportZip?: (content: string, title?: string) => void;
    onPreview?: (content: string) => void;
    onContentTypeSelect?: (type: string) => void;
    headerIcon: React.ReactNode;
    loadingSteps: string[];
    /** Restore previous chat messages when continuing a conversation */
    initialMessages?: ChatMessage[];
    /** Restore previous generation result when continuing a conversation */
    initialResult?: GenerationResult | null;
    /** Callback fired whenever messages change, so parent can persist them */
    onMessagesChange?: (messages: ChatMessage[]) => void;
    /** Auto-fill and send this text as the first message on mount */
    initialInput?: string;
    /** Auto-select this content type on mount */
    initialContentType?: string;
}

const ASSISTANT_WELCOME: Record<string, { title: string; sub: string }> = {
    MARKETING: {
        title: 'AI Marketing Assistant',
        sub: 'Describe what you need — or click the mic to speak.',
    },
    SALES: {
        title: 'AI Sales Assistant',
        sub: 'Tell me about your prospect or sales task — or click the mic to speak.',
    },
    PRODUCT: {
        title: 'AI Product Assistant',
        sub: 'Describe your product idea or documentation need — or click the mic to speak.',
    },
    ONBOARDING: {
        title: 'AI Onboarding Assistant',
        sub: 'Describe the onboarding content you need — or click the mic to speak.',
    },
    COMPANY_ADVISOR: {
        title: 'AI Company Advisor',
        sub: 'Describe your strategic question or analysis need — or click the mic to speak.',
    },
    COMPANY: {
        title: 'Company DNA',
        sub: 'Ask me anything about your company strategy, identity, culture, or team — I know your DNA.',
    },
    GENERAL_AI: {
        title: 'AI General Assistant',
        sub: 'Tell me what you need help with — or click the mic to speak.',
    },
};

/* ─── Params Card ────────────────────────────────────── */

const TYPE_KEYS = new Set(['contentType', 'outputType', 'taskType']);

function ParamsCard({ params, onGenerate, contentTypes, assistantName }: { params: Record<string, unknown>; onGenerate: () => void; contentTypes: ContentType[]; assistantName?: string }) {
    const entries = Object.entries(params).filter(([, v]) => v && String(v).trim());
    function displayValue(key: string, val: unknown): string {
        if (TYPE_KEYS.has(key)) {
            const match = contentTypes.find(t => t.value === String(val));
            if (match) return match.label;
        }
        return String(val);
    }
    return (
        <div className="artifact-bubble">
            <div className="ab-header">
                <div>
                    <div className="ab-agent-row">
                        <div className="ab-agent-icon"><Sparkles size={14} /></div>
                        <div>
                            <div className="ab-agent-name">{assistantName || 'NOUSIO'}</div>
                        </div>
                    </div>
                    <div className="ab-message">I have enough to produce a first draft.</div>
                </div>
                <div className="ab-status-chip ready">
                    <CheckCircle2 size={12} />
                    <span>Ready to generate</span>
                </div>
            </div>
            <div className="ab-body">
                <div className="ab-meta-row">
                    {entries.map(([k, v]) => (
                        <span key={k} className="ab-meta-chip">
                            {k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}: {displayValue(k, v)}
                        </span>
                    ))}
                </div>
            </div>
            <div className="ab-action-row">
                <button className="ab-btn primary" onClick={onGenerate}>
                    <Sparkles size={13} /> Generate Draft
                </button>
            </div>
        </div>
    );
}

/* ─── Structured content renderer ───────────────────── */

function renderStructured(cs: Record<string, string>, sectionOrder: [string, string][]) {
    const rendered = sectionOrder
        .filter(([key]) => cs[key] && cs[key].trim() && cs[key] !== '""' && cs[key] !== 'null' && cs[key] !== '[]')
        .map(([key, label]) => (
            <div key={key} className="aic-result-section">
                <div className="aic-result-section-label">{label}</div>
                <div className="aic-result-section-content md-content">
                    <ReactMarkdown>{cs[key]}</ReactMarkdown>
                </div>
            </div>
        ));
    return rendered.length > 0 ? rendered : null;
}

/* ─── File size helper ───────────────────────────────── */
function fmtSize(b: number) { return b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`; }

/* ─── Markdown → styled HTML (for email drafts etc.) ─── */
function markdownToStyledHtml(md: string, title?: string): string {
    // Build HTML with inline styles matching the newsletter preview
    const baseStyle = `font-family: 'Noto Sans', 'Inter', system-ui, sans-serif; font-size: 14px; line-height: 1.75; color: #1e293b;`;
    const h1Style = `font-size: 22px; font-weight: 900; margin: 32px 0 12px; color: #0f172a; letter-spacing: -0.02em; text-transform: uppercase; padding-bottom: 8px; border-bottom: 2px solid #0f172a;`;
    const h2Style = `font-size: 16px; font-weight: 900; margin: 28px 0 10px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.02em; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0;`;
    const h3Style = `font-size: 14px; font-weight: 900; margin: 24px 0 8px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;`;
    const h4Style = `font-size: 12px; font-weight: 900; margin: 18px 0 6px; color: #334155; text-transform: uppercase; letter-spacing: 0.08em;`;
    const pStyle = `margin: 0 0 14px;`;
    const strongStyle = `font-weight: 800; color: #0f172a;`;
    const liStyle = `margin-bottom: 8px; padding: 8px 12px; border-left: 4px solid #2563eb; background: #f8fafc; font-size: 13px; line-height: 1.6;`;
    const hrStyle = `border: none; height: 2px; background: #e2e8f0; margin: 28px 0;`;

    let html = md
        // Headings (process largest first to avoid double-match)
        .replace(/^#### (.+)$/gm, `<h4 style="${h4Style}">$1</h4>`)
        .replace(/^### (.+)$/gm, `<h3 style="${h3Style}">$1</h3>`)
        .replace(/^## (.+)$/gm, `<h2 style="${h2Style}">$1</h2>`)
        .replace(/^# (.+)$/gm, `<h1 style="${h1Style}">$1</h1>`)
        // Numbered headings like "1. Executive Summary"
        .replace(/^(\d+)\. \*\*(.+?)\*\*$/gm, `<h2 style="${h2Style}">$1. $2</h2>`)
        // Bold & italic
        .replace(/\*\*(.+?)\*\*/g, `<strong style="${strongStyle}">$1</strong>`)
        .replace(/\*(.+?)\*/g, `<em>$1</em>`)
        // Horizontal rules
        .replace(/^---$/gm, `<hr style="${hrStyle}" />`)
        // Unordered list items
        .replace(/^[\-\*] (.+)$/gm, `<li style="${liStyle}">$1</li>`);

    // Wrap consecutive <li> items in <ul>
    html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, `<ul style="padding-left: 0; margin: 14px 0; list-style: none;">$1</ul>`);

    // Convert remaining plain text lines into paragraphs
    const lines = html.split('\n');
    const processed: string[] = [];
    let buffer = '';

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            if (buffer) {
                processed.push(`<p style="${pStyle}">${buffer}</p>`);
                buffer = '';
            }
        } else if (trimmed.startsWith('<')) {
            if (buffer) {
                processed.push(`<p style="${pStyle}">${buffer}</p>`);
                buffer = '';
            }
            processed.push(trimmed);
        } else {
            buffer += (buffer ? ' ' : '') + trimmed;
        }
    }
    if (buffer) processed.push(`<p style="${pStyle}">${buffer}</p>`);

    // Build the final HTML document
    const titleHtml = title
        ? `<h1 style="font-size: 26px; font-weight: 900; line-height: 1.2; color: #0f172a; letter-spacing: -0.03em; text-transform: uppercase; margin: 0 0 20px; padding-bottom: 12px; border-bottom: 4px solid #0f172a;">${title}</h1>`
        : '';

    return `<div style="${baseStyle} max-width: 680px; margin: 0 auto; padding: 28px;">${titleHtml}${processed.join('\n')}</div>`;
}

/* ═══════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════ */

export default function AIAssistantChat({
    assistantType,
    contentTypes,
    workspace,
    generating,
    result,
    sectionOrder,
    onGenerate,
    onRefine,
    onSave,
    onCopy,
    onExport,
    onExportZip,
    onPreview,
    onContentTypeSelect,
    headerIcon,
    loadingSteps,
    initialMessages,
    initialResult,
    onMessagesChange,
    initialInput,
    initialContentType,
}: AIAssistantChatProps) {
    const welcome = ASSISTANT_WELCOME[assistantType];

    // ── Chat state ───────────────────────────────────────
    const [selectedType, setSelectedType] = useState(initialContentType || '');
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
    const [input, setInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [extractedParams, setExtractedParams] = useState<Record<string, unknown>>({});
    const [isReady, setIsReady] = useState(false);

    // ── Artifact state (all assistants) ──
    const [artifactId, setArtifactId] = useState<string | null>(null);
    const [bubbleState, setBubbleState] = useState<BubbleState>('collecting');
    const [artifactMeta, setArtifactMeta] = useState<ArtifactMeta>({});
    const [artifactProgressIndex, setArtifactProgressIndex] = useState(0);
    const [artifactVersions, setArtifactVersions] = useState<any[]>([]);
    const [artifactData, setArtifactData] = useState<any | null>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [isIterating, setIsIterating] = useState(false);
    const prevResultRef = useRef<typeof result>(null);
    const isDesignAssistant = /design|brand|DESIGN_BRAND/i.test(assistantType);

    // Auto-send initialInput on mount
    const initialInputSent = useRef(false);
    useEffect(() => {
        if (initialInput && !initialInputSent.current) {
            initialInputSent.current = true;
            // Small delay to let the component fully mount
            setTimeout(() => handleSend(initialInput), 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialInput]);

    // ── Rating state ─────────────────────────────────────
    const [userRating, setUserRating] = useState<'up' | 'down' | null>(null);

    // ── Preview state ────────────────────────────────────
    const [previewContent, setPreviewContent] = useState<{ title: string; content: string } | null>(null);
    const [codePreviewOpen, setCodePreviewOpen] = useState(false);

    // Detect if content contains renderable code (HTML/JSX/React+Tailwind)
    const hasRenderableCode = useCallback((content: string) => {
        if (!content) return false;
        return /```(?:html|jsx|tsx|react|javascript|js)?\n/i.test(content)
            || /<div[\s>]/i.test(content)
            || /className=/i.test(content)
            || /class="[^"]*(?:flex|grid|bg-|text-|p-|m-)/i.test(content);
    }, []);

    // Build preview HTML from code output
    const buildPreviewHtml = useCallback((rawOutput: string) => {
        let code = rawOutput;

        // 0. Detect Presentation YAML Payload
        if (code.includes('presentation:') && code.includes('slides:')) {
            return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Presentation Preview</title>
    <script src="https://cdn.tailwindcss.com"></` + `script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js"></` + `script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
    <style>
        body { font-family: 'Inter', sans-serif; background: #f1f5f9; }
        @media print {
            @page { margin: 0; size: landscape; }
            body { background: white !important; padding: 0 !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: hidden; }
            .no-print { display: none !important; }
            .slide-card { 
                page-break-inside: avoid; 
                page-break-after: always; 
                box-shadow: none !important; 
                border: 1px solid #e2e8f0 !important; 
                margin-bottom: 2rem !important;
            }
            .slide-card:last-child { page-break-after: auto; }
        }
    </style>
</head>
<body class="p-8 md:p-12 pb-32 print:p-0 font-sans bg-slate-50 print:bg-white text-slate-900">
    <button onclick="window.focus(); setTimeout(function(){window.print();}, 100);" class="no-print fixed top-6 right-6 px-6 py-3 text-[11px] font-black text-white bg-blue-600 border-2 border-slate-900 uppercase tracking-widest shadow-[4px_4px_0px_#000000] transition-all hover:bg-blue-700 active:translate-y-1 active:translate-x-1 active:shadow-[0px_0px_0px_#000000] z-50 flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
        Export PDF
    </button>
    <div id="deck" class="max-w-5xl mx-auto space-y-16 print:space-y-0 print:block print:max-w-none print:w-full print:m-0 print:p-0">
        <div class="text-center text-slate-500 py-20 text-lg flex flex-col items-center justify-center">
            <svg class="animate-spin h-8 w-8 mb-4 border-4 border-slate-300 border-t-blue-600 rounded-full" viewBox="0 0 24 24"></svg>
            Generating presentation view...
        </div>
    </div>
    <script>
        console.log('[RenderUI] Starting YAML parse...');
        try {
            const rawContent = ${JSON.stringify(rawOutput)};
            const yamlMatch = rawContent.match(/\\u0060\\u0060\\u0060(?:yaml|yml)?\\n([\\s\\S]*?)\\u0060\\u0060\\u0060/i);
            const yamlString = yamlMatch ? yamlMatch[1] : rawContent;
            
            const startIndex = yamlString.indexOf('presentation:');
            if (startIndex === -1) throw new Error("Could not find 'presentation:' block");
            
            console.log('[RenderUI] Parsed string, loading jsyaml...');
            const parsed = jsyaml.load(yamlString.substring(startIndex));
            const p = parsed.presentation;
            
            let html = '<div class="mb-16 print:hidden border-b-4 border-slate-900 pb-8">';
            html += '<h1 class="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tighter uppercase leading-tight">' + (p.objective || 'Presentation Deck') + '</h1>';
            html += '<div class="flex flex-wrap gap-4 items-center text-[11px] font-black uppercase tracking-widest text-slate-900">';
            html += '<span class="flex items-center gap-2 border-2 border-slate-900 px-4 py-2 bg-white shadow-[2px_2px_0px_#000000]">AUDIENCE: ' + (p.audience || 'General Payload') + '</span>';
            if (p.tone) html += '<span class="flex items-center gap-2 border-2 border-slate-900 px-4 py-2 bg-white shadow-[2px_2px_0px_#000000]">TONE: ' + p.tone + '</span>';
            html += '</div></div>';
            
            if (p.slides && Array.isArray(p.slides)) {
                p.slides.forEach(function(slide) {
                    html += '<div class="slide-card bg-white border-4 border-slate-900 shadow-[8px_8px_0px_#000000] print:shadow-none print:border-0 mb-16 print:mb-0 relative print:h-[100vh] print:w-full print:flex print:flex-col print:break-inside-avoid print:break-after-page print:overflow-hidden print:box-border">';
                    html += '<div class="bg-slate-900 text-white px-6 sm:px-8 print:px-8 py-4 print:py-3 flex flex-wrap gap-4 justify-between items-center text-[11px] font-black uppercase tracking-widest flex-shrink-0">';
                    html += '<span class="flex items-center gap-3"><div class="bg-blue-600 text-white w-8 h-8 print:w-6 print:h-6 flex items-center justify-center border-2 border-slate-900 print:text-[11px]">' + slide.slide_number + '</div> <span class="print:text-[11px]">' + (slide.slide_type || 'SLIDE') + '</span></span>';
                    html += '</div>';
                    
                    html += '<div class="p-8 sm:p-12 print:px-10 print:py-6 border-b-4 border-slate-900 print:border-none flex-1 flex flex-col justify-center">';
                    html += '<div>'; // inner wrapper to center content vertically
                    if (slide.title) html += '<h2 class="text-4xl sm:text-5xl md:text-6xl print:text-3xl font-black text-slate-900 mb-4 print:mb-2 leading-none uppercase tracking-tighter">' + slide.title + '</h2>';
                    if (slide.subtitle) html += '<h3 class="text-xl sm:text-2xl print:text-lg font-bold text-blue-600 mb-10 print:mb-6 max-w-3xl leading-snug tracking-tight">' + slide.subtitle + '</h3>';
                    
                    html += '<div class="flex flex-col md:flex-row gap-8 md:gap-14 print:gap-8">';
                    html += '<div class="flex-1 space-y-6 print:space-y-4">';
                    if (slide.body) html += '<p class="text-slate-900 text-lg md:text-xl print:text-[13px] font-medium leading-relaxed">' + slide.body + '</p>';
                    if (slide.bullets && slide.bullets.length > 0) {
                        html += '<ul class="space-y-5 print:space-y-3">';
                        slide.bullets.forEach(function(b) {
                            html += '<li class="flex items-start text-slate-900 text-lg md:text-xl print:text-[13px] font-medium leading-relaxed"><div class="w-3 h-3 print:w-2 print:h-2 bg-blue-600 border-2 print:border-2 border-slate-900 mt-2 print:mt-1 mr-4 print:mr-3 flex-shrink-0"></div><span>' + b + '</span></li>';
                        });
                        html += '</ul>';
                    }
                    html += '</div>';
                    
                    if (slide.data_points && slide.data_points.length > 0) {
                        html += '<div class="w-full md:w-80 lg:w-[400px] print:w-[260px] flex-shrink-0">';
                        html += '<div class="bg-blue-50 border-4 print:border-2 border-slate-900 p-8 print:p-5 h-full shadow-[4px_4px_0px_#000000] print:shadow-[2px_2px_0px_#000000]">';
                        html += '<h4 class="text-[11px] print:text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6 print:mb-4 pb-3 print:pb-2 border-b-2 border-slate-900">Key Data Points</h4>';
                        html += '<ul class="space-y-5 print:space-y-3">';
                        slide.data_points.forEach(function(d) {
                            html += '<li class="flex gap-4 print:gap-2 items-start"><span class="text-blue-600 font-black mt-1 print:mt-0 text-xl print:text-sm leading-none">&rarr;</span><span class="text-slate-900 font-bold text-base print:text-xs leading-snug">' + d + '</span></li>';
                        });
                        html += '</ul></div></div>';
                    }
                    html += '</div></div></div>'; // end inner wrapper and main content flex
                    
                    // Presenter Notes / Visual Notes Footer
                    if (slide.speaker_notes || slide.visual_notes || slide.layout_instructions) {
                        html += '<div class="no-print bg-slate-100 px-6 sm:px-10 print:px-8 py-8 print:py-4 text-sm print:text-xs grid grid-cols-1 md:grid-cols-2 gap-x-12 print:gap-x-8 gap-y-8 print:gap-y-3 flex-shrink-0 border-t-4 print:border-t-2 border-slate-900">';
                        if (slide.speaker_notes) html += '<div><span class="text-slate-900 font-black block mb-4 print:mb-2 uppercase text-[11px] print:text-[9px] tracking-widest border-b-2 print:border-b border-slate-900 pb-2 print:pb-1">Speaker Notes</span><p class="leading-relaxed font-medium text-slate-700">' + slide.speaker_notes + '</p></div>';
                        if (slide.visual_notes || slide.layout_instructions) {
                            html += '<div><span class="text-slate-900 font-black block mb-4 print:mb-2 uppercase text-[11px] print:text-[9px] tracking-widest border-b-2 print:border-b border-slate-900 pb-2 print:pb-1">Visual & Layout Strategy</span><ul class="space-y-3 print:space-y-1 font-medium text-slate-700">';
                            if (slide.visual_notes) html += '<li class="flex gap-2"><span class="text-blue-600 font-black">&rarr;</span> <span>' + slide.visual_notes + '</span></li>';
                            if (slide.layout_instructions) html += '<li class="flex gap-3"><span class="text-blue-600 font-black">&rarr;</span> <span class="text-slate-500 italic">' + slide.layout_instructions + '</span></li>';
                            html += '</ul></div>';
                        }
                        html += '</div>';
                    }
                    html += '</div>'; // end slide card
                });
            }
            
            document.getElementById('deck').innerHTML = html;
        } catch (e) {
            document.getElementById('deck').innerHTML = '<div class="bg-red-50 text-red-600 p-8 rounded-2xl border border-red-200 shadow-sm max-w-3xl mx-auto"><div class="flex items-center gap-3 mb-4"><svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><strong class="text-lg">Presentation parsing failed</strong></div><p class="mb-4">Could not parse the YAML payload. Ensure the output strictly follows the \\'presentation\\' payload schema.</p><div class="bg-red-900/5 p-4 rounded-lg overflow-x-auto"><code class="text-xs font-mono text-slate-700 whitespace-pre-wrap">' + e.message + '</code></div></div>';
            console.error(e);
        }
    </` + `script>
</body>
</html>`;
        }

        // 1. Extract code from markdown fenced blocks — pick the LARGEST block
        const codeBlockRegex = /```(?:html|jsx|tsx|react|javascript|js|typescript|ts)?\n([\s\S]*?)```/g;
        let match;
        let largestBlock = '';
        while ((match = codeBlockRegex.exec(code)) !== null) {
            if (match[1].length > largestBlock.length) largestBlock = match[1];
        }
        if (largestBlock) {
            code = largestBlock;
        } else {
            // Positive markdown detection: if content has markdown headers, it's markdown
            const hasMarkdownHeaders = /^#{1,4}\s+\S/m.test(code);
            const hasImport = /^import\s+/m.test(code);
            const isStructuralHtml = /^\s*<(!DOCTYPE|html|head|body|div\s|section\s)/im.test(code);
            if (hasMarkdownHeaders && !hasImport && !isStructuralHtml) {
                // Pure markdown content — render via marked.js
                return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
<style>
body { font-family: 'Inter', sans-serif; margin: 0; padding: 40px 48px; color: #0f172a; line-height: 1.7; max-width: 860px; }
h1 { font-size: 28px; font-weight: 800; margin: 32px 0 16px; border-bottom: 3px solid #0f172a; padding-bottom: 8px; }
h2 { font-size: 22px; font-weight: 700; margin: 28px 0 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
h3 { font-size: 18px; font-weight: 700; margin: 24px 0 8px; }
h4 { font-size: 15px; font-weight: 700; margin: 20px 0 6px; }
p { margin: 0 0 16px; font-size: 15px; }
ul, ol { margin: 0 0 16px; padding-left: 24px; }
li { margin-bottom: 6px; font-size: 15px; }
code { background: #f1f5f9; padding: 2px 6px; font-size: 13px; font-family: 'Menlo', monospace; border: 1px solid #e2e8f0; }
pre { background: #0f172a; color: #e2e8f0; padding: 16px 20px; overflow-x: auto; margin: 0 0 16px; font-size: 13px; }
pre code { background: none; border: none; padding: 0; color: inherit; }
blockquote { border-left: 4px solid #2563eb; margin: 0 0 16px; padding: 8px 16px; background: #f8fafc; color: #334155; }
table { border-collapse: collapse; width: 100%; margin: 0 0 16px; }
th { background: #0f172a; color: #fff; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
tr:hover td { background: #f8fafc; }
hr { border: none; border-top: 2px solid #e2e8f0; margin: 32px 0; }
strong { font-weight: 700; }
a { color: #2563eb; }
</style>
</head>
<body>
<div id="content"></div>
<script>
document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(code)});
<\/script>
</body>
</html>`;
            }
            // Fallback: no fenced code block found — extract from first import statement
            const importIdx = code.search(/^import\s+/m);
            if (importIdx > 0) code = code.substring(importIdx);
        }

        // 2. Detect if this is React code (has hooks, imports, component exports)
        const isReactCode = /import\s+React|useState|useEffect|useMemo|useCallback|useRef|export\s+default\s+function/.test(code);

        if (isReactCode) {
            // ── React Live Rendering: React 18 + Babel Standalone with TypeScript preset ──
            // Strip import lines (React/ReactDOM will be global via CDN)
            code = code.replace(/^import\s+.*$/gm, '');
            // Find the default export component name
            const exportMatch = code.match(/export\s+default\s+function\s+(\w+)/);
            const componentName = exportMatch?.[1] || 'App';
            // Replace 'export default function X' with 'function X' (keep the function)
            code = code.replace(/export\s+default\s+function/, 'function');
            // Prepend React hooks destructuring and append window assignment
            code = `const { useState, useEffect, useMemo, useCallback, useRef, memo, createContext, useContext, Fragment } = React;\n${code}\nwindow['${componentName}'] = ${componentName};`;

            return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></` + `script>
<script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></` + `script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></` + `script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></` + `script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>body{font-family:'Inter',sans-serif;margin:0;padding:0}*{box-sizing:border-box}</style>
</head>
<body>
<div id="root"><div style="padding:40px;text-align:center;color:#94a3b8;font-size:14px;">Loading preview...</div></div>
<script>
window.addEventListener('DOMContentLoaded', function() {
  var codeStr = ${JSON.stringify(code)};
  try {
    var output = Babel.transform(codeStr, { presets: ['react', 'typescript'], filename: 'preview.tsx' });
    var fn = new Function('React', 'ReactDOM', output.code);
    fn(React, ReactDOM);
    var componentName = '${componentName}';
    if (window[componentName]) {
      var root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(window[componentName]));
    }
  } catch(e) {
    document.getElementById('root').innerHTML = '<div style="padding:24px;color:#ef4444;font-family:monospace;font-size:13px;white-space:pre-wrap;"><strong>Render Error:</strong><br/>' + e.message + '</div>';
    console.error('Preview render error:', e);
  }
});
</` + `script>
</body>
</html>`;
        }

        // ── Fallback: Static HTML conversion for simple HTML/Tailwind output ──
        code = code.replace(/^\s*import\s+.*$/gm, '');
        code = code.replace(/^\s*require\(.*$/gm, '');
        code = code.replace(/^\s*export\s+default\s+/gm, '');
        code = code.replace(/^\s*export\s+/gm, '');
        const returnMatch = code.match(/return\s*\(([\s\S]*?)\);?\s*\}\s*$/m);
        if (returnMatch) { code = returnMatch[1].trim(); }
        else { const arrowMatch = code.match(/=>\s*\(([\s\S]*?)\);?\s*$/m); if (arrowMatch) code = arrowMatch[1].trim(); }
        code = code
            .replace(/className=/g, 'class=')
            .replace(/htmlFor=/g, 'for=')
            .replace(/\{["']([^"']*)["']\}/g, '"$1"')
            .replace(/\{[^{}]*\}/g, '')
            .replace(/\s(on[A-Z]\w+)=\{[^}]*\}/g, '')
            .replace(/<(img|input|br|hr)\s+([^>]*?)\s*\/>/gi, '<$1 $2>');
        code = code.replace(/^\s*(const|let|var|function)\s+.*$/gm, '');
        return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><script src="https://cdn.tailwindcss.com"><\/script><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/><style>body{font-family:'Inter',sans-serif;margin:0;padding:0}*{box-sizing:border-box}</style></head><body>${code}</body></html>`;
    }, []);

    async function handleRate(direction: 'up' | 'down') {
        if (!result) return;
        setUserRating(direction);
        const skillKey = selectedType || (result as Record<string, unknown>).contentType || (result as Record<string, unknown>).taskType || (result as Record<string, unknown>).outputType || '';
        try {
            await fetch('/api/ai/skills/rate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    skillKey: String(skillKey).toUpperCase(),
                    assistantType,
                    generationRunId: result.generationRunId,
                    rating: direction === 'up' ? 5 : 1,
                }),
            });
        } catch { /* silent */ }
    }

    // Detect content type from result when resuming from history
    useEffect(() => {
        if (result && !selectedType) {
            const type = (result as Record<string, unknown>).contentType
                || (result as Record<string, unknown>).taskType
                || (result as Record<string, unknown>).outputType;
            if (type && typeof type === 'string') setSelectedType(type);
        }
    }, [result, selectedType]);
    const [resultCollapsed, setResultCollapsed] = useState(false);

    // ── External Actions state ────────────────────────────
    interface SchemaProperty { type?: string; description?: string; title?: string; }
    interface ExternalActionData { id: string; name: string; description: string | null; serviceApp: string; toolName: string; inputSchema?: { properties?: Record<string, SchemaProperty>; required?: string[] }; }
    const [skillActions, setSkillActions] = useState<ExternalActionData[]>([]);
    const [executingAction, setExecutingAction] = useState<ExternalActionData | null>(null);
    const [executeLoading, setExecuteLoading] = useState(false);
    const [executeResult, setExecuteResult] = useState<{ success: boolean; message: string } | null>(null);
    const [actionParams, setActionParams] = useState<Record<string, string>>({});

    // Fetch external actions when result is generated
    useEffect(() => {
        if (!result) { setSkillActions([]); return; }
        const skillKey = selectedType || (result as Record<string, unknown>).contentType || (result as Record<string, unknown>).taskType || (result as Record<string, unknown>).outputType || '';
        if (!skillKey) return;

        async function loadActions() {
            try {
                // Get the skill's enabledActions by key
                const skillsRes = await fetch(`/api/ai/skills?assistantType=${assistantType}`);
                const skillsData = await skillsRes.json();
                const skill = (skillsData.skills || []).find((s: { key: string }) =>
                    s.key.toUpperCase() === String(skillKey).toUpperCase()
                );
                if (!skill?.enabledActions?.length) { setSkillActions([]); return; }

                // Load the external action details
                const actionsRes = await fetch('/api/external-actions');
                const actionsData = await actionsRes.json();
                const enabled = (actionsData.actions || []).filter((a: { id: string }) =>
                    skill.enabledActions.includes(a.id)
                );
                setSkillActions(enabled);
            } catch { setSkillActions([]); }
        }
        loadActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result, selectedType, assistantType]);

    // Pre-fill form params when opening the modal
    function openActionModal(action: ExternalActionData) {
        const schema = typeof action.inputSchema === 'string' ? JSON.parse(action.inputSchema) : action.inputSchema;
        const props = schema?.properties || {};
        const prefilled: Record<string, string> = {};

        // Smart pre-fill based on param names
        const styledHtml = markdownToStyledHtml(result?.content || '', result?.title);
        for (const key of Object.keys(props)) {
            const lk = key.toLowerCase();
            if (lk.includes('body') || lk.includes('message') || lk.includes('content') || lk.includes('text')) {
                prefilled[key] = styledHtml;
            } else if (lk.includes('subject') || lk.includes('title') || lk.includes('name')) {
                prefilled[key] = result?.title || '';
            } else {
                prefilled[key] = '';
            }
        }
        setActionParams(prefilled);
        setExecutingAction(action);
        setExecuteResult(null);
    }

    async function handleExecuteAction(action: ExternalActionData) {
        setExecuteLoading(true);
        setExecuteResult(null);
        try {
            // Coerce param types based on schema
            const schema = typeof action.inputSchema === 'string' ? JSON.parse(action.inputSchema) : action.inputSchema;
            const schemaProps = schema?.properties || {};
            const coerced: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(actionParams)) {
                if (!val || !val.trim()) continue; // skip empty values
                const propType = schemaProps[key]?.type;
                if (propType === 'array') {
                    // Split comma-separated values into an array
                    coerced[key] = val.split(',').map(v => v.trim()).filter(Boolean);
                } else {
                    coerced[key] = val;
                }
            }

            const res = await fetch('/api/external-actions/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actionId: action.id,
                    params: coerced,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setExecuteResult({ success: true, message: `"${action.name}" executed successfully!` });
            } else {
                setExecuteResult({ success: false, message: data.error || 'Execution failed' });
            }
        } catch {
            setExecuteResult({ success: false, message: 'Connection error' });
        } finally {
            setExecuteLoading(false);
        }
    }

    // ── Generate PDF from preview for sharing ─────────────
    const generatePreviewPdf = useCallback(async (): Promise<Blob | null> => {
        const el = newsletterRef.current;
        if (!el) return null;
        try {
            // Clone the newsletter modal to render full content without scroll constraints
            const clone = el.cloneNode(true) as HTMLElement;
            // Remove toolbar, actions, footer, close button, and header from the clone
            clone.querySelectorAll('.newsletter-toolbar, .newsletter-actions, .newsletter-footer, .newsletter-close-btn, .newsletter-header, .newsletter-divider')
                .forEach(n => n.remove());
            // Style the clone for off-screen full-height rendering — no card look
            Object.assign(clone.style, {
                position: 'fixed',
                left: '-9999px',
                top: '0',
                width: '720px',
                maxHeight: 'none',
                height: 'auto',
                overflow: 'visible',
                zIndex: '-1',
                boxShadow: 'none',
                border: 'none',
                borderRadius: '0',
                padding: '40px 48px',
                background: '#ffffff',
            });
            document.body.appendChild(clone);

            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const canvas = await html2canvas(clone, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: 720,
                windowWidth: 720,
            });
            document.body.removeChild(clone);

            // A4 dimensions in mm
            const pageW = 210;
            const pageH = 297;
            const margin = 5;
            const contentW = pageW - margin * 2;
            const contentH = pageH - margin * 2;

            // Scale canvas to fit A4 width
            const imgW = contentW;
            const imgH = (canvas.height * imgW) / canvas.width;

            const pdf = new jsPDF({ unit: 'mm', format: 'a4' });

            if (imgH <= contentH) {
                // Single page
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH);
            } else {
                // Multi-page: slice the canvas into page-sized chunks
                const scaleFactor = canvas.width / imgW;
                const sliceHeightPx = contentH * scaleFactor;
                let yOffset = 0;
                let pageNum = 0;

                while (yOffset < canvas.height) {
                    if (pageNum > 0) pdf.addPage();
                    const sliceH = Math.min(sliceHeightPx, canvas.height - yOffset);
                    // Create a slice canvas for this page
                    const pageCanvas = document.createElement('canvas');
                    pageCanvas.width = canvas.width;
                    pageCanvas.height = sliceH;
                    const ctx = pageCanvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
                        const sliceImgH = (sliceH * imgW) / canvas.width;
                        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, sliceImgH);
                    }
                    yOffset += sliceH;
                    pageNum++;
                }
            }

            return pdf.output('blob');
        } catch (err) {
            console.error('[generatePreviewPdf] error:', err);
            return null;
        }
    }, []);

    // ── User avatar ──────────────────────────────────────
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [userInitials, setUserInitials] = useState('You');
    useEffect(() => {
        fetch('/api/user/profile').then(r => r.json()).then(d => {
            if (d.profile) {
                if (d.profile.avatarUrl) setUserAvatar(d.profile.avatarUrl);
                if (d.profile.name) {
                    const parts = d.profile.name.trim().split(/\s+/);
                    setUserInitials(parts.map((p: string) => p[0]).join('').toUpperCase().slice(0, 2));
                }
            }
        }).catch(() => {});
    }, []);

    // Sync initial state when continuing a conversation
    useEffect(() => {
        if (initialMessages && initialMessages.length > 0) {
            setMessages(initialMessages);
        } else if (initialMessages === undefined) {
            setMessages([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialMessages]);

    // Notify parent whenever messages change
    useEffect(() => {
        if (onMessagesChange) {
            onMessagesChange(messages);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages]);

    // ── Voice state ──────────────────────────────────────
    const [voiceMode, setVoiceMode] = useState<'idle' | 'recording' | 'transcribing'>('idle');
    const [voiceSeconds, setVoiceSeconds] = useState(0);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const whisper = useWhisper({
        onTranscript: (text) => {
            const combined = (voiceTranscript ? voiceTranscript + ' ' : '') + text;
            setVoiceTranscript(combined.trim());
            setInput(combined.trim());
            setVoiceMode('idle');
        },
        onError: () => {
            // Reset voice mode on any transcription failure so the UI never gets stuck
            setVoiceMode('idle');
        },
    });

    // ── Attachment state ─────────────────────────────────
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [showDocPicker, setShowDocPicker] = useState(false);
    const [workspaceDocs, setWorkspaceDocs] = useState<DocumentOption[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── UI refs ──────────────────────────────────────────
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLElement>(null);
    const newsletterRef = useRef<HTMLDivElement>(null);
    const [loadingStep, setLoadingStep] = useState(0);

    // Auto-resize textarea when input changes programmatically (e.g. voice transcription)
    useEffect(() => {
        const el = inputRef.current as HTMLTextAreaElement | null;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }, [input]);
    const stepsTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const isPostGeneration = result !== null;
    const isFirstMessage = messages.length === 0;

    /* ─── Scroll to bottom ──────────────────────────── */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, generating]);

    /* ─── Loading step animation ────────────────────── */
    useEffect(() => {
        if (generating) {
            setLoadingStep(0);
            stepsTimer.current = setInterval(() => setLoadingStep(s => (s < loadingSteps.length - 1 ? s + 1 : s)), 2500);
        } else {
            if (stepsTimer.current) clearInterval(stepsTimer.current);
        }
        return () => { if (stepsTimer.current) clearInterval(stepsTimer.current); };
    }, [generating, loadingSteps.length]);

    /* ─── Load workspace docs for attachment picker ─── */
    useEffect(() => {
        if (!workspace?.id) { setWorkspaceDocs([]); return; }
        fetch(`/api/documents/upload?projectId=${workspace.id}`)
            .then(r => r.json())
            .then((docs: DocumentOption[]) => setWorkspaceDocs(Array.isArray(docs) ? docs : []))
            .catch(() => {});
    }, [workspace?.id]);

    /* ─── Cleanup voice on unmount ──────────────────── */
    useEffect(() => {
        return () => {
            if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
        };
    }, []);

    /* ─── Export ZIP Logic ──────────────────────────── */
    async function handleExportZip(content: string, title?: string) {
        try {
            const zip = new JSZip();
            // Regex to match code blocks with filenames, e.g. ```language path/to/file.ext
            // Group 1: language (optional), Group 2: filepath, Group 3: code content
            const fileBlockRegex = /```([\w-]*)\s+([\w./-]+(?:\\.[\w-]+)+)\n([\s\S]*?)```/g;
            let match;
            let filesFound = false;

            while ((match = fileBlockRegex.exec(content)) !== null) {
                const filepath = match[2].trim();
                const code = match[3].trim();
                if (filepath && code) {
                    zip.file(filepath, code);
                    filesFound = true;
                }
            }

            // Fallback 1: look for "# FILE: filename.ext" markers (used by team creation and similar skills)
            if (!filesFound) {
                const lines = content.split(/\r?\n/);
                const fileMarkerRegex = /^[#\s*_\-]*FILE:\s*([^\s*_]+\.\w+)/i;
                let currentFileName: string | null = null;
                let currentContent: string[] = [];

                for (const line of lines) {
                    const markerMatch = line.match(fileMarkerRegex);
                    if (markerMatch) {
                        if (currentFileName && currentContent.length > 0) {
                            zip.file(currentFileName, currentContent.join('\n').trim() + '\n');
                            filesFound = true;
                        }
                        currentFileName = markerMatch[1].trim();
                        currentContent = [];
                    } else if (currentFileName) {
                        // Skip separator lines between files (---, ===)
                        if (/^[\-=]{3,}\s*$/.test(line.trim()) && currentContent.length === 0) continue;
                        currentContent.push(line);
                    }
                }
                if (currentFileName && currentContent.length > 0) {
                    zip.file(currentFileName, currentContent.join('\n').trim() + '\n');
                    filesFound = true;
                }
            }

            // Fallback 2: look for plain-text file path headers
            if (!filesFound) {
                const lines = content.split(/\r?\n/);
                const fileHeaderRegex = /^[\s#*_\-`]*([\w./-]+\.(?:md|yaml|yml|json|txt|js|ts|tsx|jsx|css|html|csv))[\s*_\-`]*$/i;
                let currentFileName: string | null = null;
                let currentContent: string[] = [];

                for (const line of lines) {
                    const headerMatch = line.match(fileHeaderRegex);
                    if (headerMatch) {
                        if (currentFileName && currentContent.length > 0) {
                            zip.file(currentFileName, currentContent.join('\n').trim() + '\n');
                            filesFound = true;
                        }
                        currentFileName = headerMatch[1];
                        currentContent = [];
                    } else if (currentFileName) {
                        currentContent.push(line);
                    }
                }
                if (currentFileName && currentContent.length > 0) {
                    zip.file(currentFileName, currentContent.join('\n').trim() + '\n');
                    filesFound = true;
                }
            }

            // Fallback 2: if still no files found, export the whole content as markdown
            if (!filesFound) {
                zip.file(`${title || 'export'}.md`, content);
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title?.replace(/[^a-z0-9]/gi, '_') || 'export'}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[AIAssistantChat] Failed to create ZIP:', err);
        }
    }

    /* ─── Close format dropdown on click outside ────── */
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            const dropdown = document.querySelector('.aic-format-dropdown');
            if (dropdown && !dropdown.contains(e.target as Node)) {
                document.querySelector('.aic-format-menu')?.classList.remove('open');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    /* ─── Voice Recording ───────────────────────────── */
    function fmtTime(s: number) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }

    const startVoice = useCallback(async () => {
        setVoiceSeconds(0);
        setVoiceMode('recording');
        voiceTimerRef.current = setInterval(() => setVoiceSeconds(s => s + 1), 1000);
        await whisper.startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stopVoice = useCallback(async () => {
        if (voiceTimerRef.current) { clearInterval(voiceTimerRef.current); voiceTimerRef.current = null; }
        setVoiceMode('transcribing');
        await whisper.stopRecording();
        // voiceMode set to 'idle' and input/voiceTranscript set via onTranscript callback
        setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Manually cancel a stuck transcribing state */
    const cancelVoice = useCallback(() => {
        if (voiceTimerRef.current) { clearInterval(voiceTimerRef.current); voiceTimerRef.current = null; }
        setVoiceMode('idle');
        setVoiceSeconds(0);
    }, []);

    /* ─── Safety timeout: auto-cancel stuck transcribing after 30s ── */
    useEffect(() => {
        if (voiceMode !== 'transcribing') return;
        const timeout = setTimeout(() => {
            console.warn('[AIAssistantChat] Voice transcription timed out after 30s, resetting.');
            setVoiceMode('idle');
        }, 30_000);
        return () => clearTimeout(timeout);
    }, [voiceMode]);

    /* ─── Attachments ───────────────────────────────── */
    async function handleFileSelect(files: FileList | null) {
        if (!files) return;
        const newAttachments: Attachment[] = [];
        for (const file of Array.from(files)) {
            let preview: string | undefined;
            if (file.type.startsWith('image/')) {
                preview = await new Promise<string>(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });
            }
            newAttachments.push({ id: crypto.randomUUID(), name: file.name, type: 'file', file, preview });
        }
        setAttachments(prev => [...prev, ...newAttachments]);
    }

    function toggleDocAttachment(doc: DocumentOption) {
        setAttachments(prev => {
            const exists = prev.find(a => a.docId === doc.id);
            if (exists) return prev.filter(a => a.docId !== doc.id);
            return [...prev, { id: crypto.randomUUID(), name: doc.filename, type: 'doc', docId: doc.id }];
        });
    }

    function removeAttachment(id: string) { setAttachments(prev => prev.filter(a => a.id !== id)); }

    /* ─── Send message ──────────────────────────────── */
    async function handleSend(overrideText?: string) {
        const text = (overrideText ?? input).trim();
        if (!text || chatLoading || generating) return;

        const userMsg: ChatMessage = { role: 'user', content: text, attachments: attachments.length > 0 ? [...attachments] : undefined };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setVoiceTranscript('');
        setVoiceMode('idle');
        setAttachments([]);
        setShowDocPicker(false);
        setChatLoading(true);

        // Build attachment context for the API
        const docIds = attachments.filter(a => a.type === 'doc').map(a => a.docId!);
        const fileNames = attachments.filter(a => a.type === 'file').map(a => a.name);

        try {
            const res = await fetch('/api/ai-assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assistantType,
                    messages: newMessages.filter(m => !m.isParams).map(m => ({ role: m.role, content: m.content })),
                    contentType: selectedType || '',
                    availableContentTypes: contentTypes.map(c => c.value),
                    workspace: workspace ? { id: workspace.id, name: workspace.name, contextText: workspace.contextText } : null,
                    extractedParams,
                    result: isPostGeneration ? result : undefined,
                    attachmentDocIds: docIds.length > 0 ? docIds : undefined,
                    attachmentFileNames: fileNames.length > 0 ? fileNames : undefined,
                }),
            });
            const data = await res.json();

            // If the API auto-selected a content type, apply it
            if (data.extractedParams?.contentType && !selectedType) {
                setSelectedType(data.extractedParams.contentType as string);
            } else if (data.extractedParams?.taskType && !selectedType) {
                setSelectedType(data.extractedParams.taskType as string);
            } else if (data.extractedParams?.outputType && !selectedType) {
                setSelectedType(data.extractedParams.outputType as string);
            }

            // Refinement mode
            if (data.refinementAction && result) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
                onRefine(data.refinementAction, result.content);
                return;
            }

            setExtractedParams(data.extractedParams || {});
            const nextIsReady = data.isReady ?? false;
            setIsReady(nextIsReady);

            const assistantMessages: ChatMessage[] = [{ role: 'assistant', content: data.reply }];
            if (nextIsReady && Object.keys(data.extractedParams || {}).length > 0) {
                assistantMessages.push({ role: 'assistant', content: '__PARAMS_CARD__', isParams: true });

                // ── Sync artifact metadata from extracted params (all assistants) ──
                {
                    const ep = data.extractedParams;
                    const newMeta: ArtifactMeta = {
                        audience: ep.audience as string || ep.audienceType as string || artifactMeta.audience,
                        goal: ep.goal as string || ep.objective as string || artifactMeta.goal,
                        contentType: ep.contentType as string || ep.outputType as string || ep.taskType as string || selectedType || artifactMeta.contentType,
                        topic: ep.topic as string || ep.productOrFeature as string || ep.prospectCompanyName as string || artifactMeta.topic,
                        platform: ep.platform as string || artifactMeta.platform,
                    };
                    setArtifactMeta(newMeta);
                    // For non-design, we're simpler — if params are ready, bubble is ready
                    setBubbleState('ready');
                }
            }
            setMessages(prev => [...prev, ...assistantMessages]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
        } finally {
            setChatLoading(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }

    /* ─── Generate from params card ────────────────── */
    function handleGenerateFromParams() {
        onGenerate({ ...extractedParams, contentType: selectedType || extractedParams.contentType });
    }

    /* ─── Auto-sync result prop → artifact state ──── */
    useEffect(() => {
        if (result && result !== prevResultRef.current && !isDesignAssistant) {
            prevResultRef.current = result;
            // Auto-create artifact + version from result
            const syncArtifact = async () => {
                try {
                    let artId = artifactId;
                    const artType = selectedType || artifactMeta.contentType || 'content';
                    if (!artId) {
                        const createRes = await fetch('/api/artifacts', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId: crypto.randomUUID(),
                                agentId: assistantType,
                                artifactType: artType,
                                title: result.title || `${artType} Draft`,
                                metadata: { ...extractedParams, ...artifactMeta },
                            }),
                        });
                        if (createRes.ok) {
                            const cd = await createRes.json();
                            artId = cd.artifact.id;
                            setArtifactId(artId!);
                            setArtifactData(cd.artifact);
                        }
                    }
                    // Create a version from the result content
                    if (artId) {
                        const versionNumber = artifactVersions.length + 1;
                        const version = {
                            id: crypto.randomUUID(),
                            versionNumber,
                            status: 'GENERATED',
                            outputPayload: {
                                type: 'text',
                                content: result.content,
                                contentStructured: result.contentStructured,
                                title: result.title,
                            },
                            summary: result.title || 'Generated content',
                            createdAt: new Date().toISOString(),
                        };
                        setArtifactVersions(prev => [...prev, version]);
                        setArtifactData((prev: any) => ({
                            ...prev,
                            title: result.title || prev?.title,
                            summary: result.title,
                            currentVersionId: version.id,
                        }));
                    }
                    setBubbleState('generated');
                } catch {
                    setBubbleState('generated');
                }
            };
            syncArtifact();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result]);

    /* ─── Handle type change from grid ─────────────── */
    function handleTypeChange(type: string) {
        if (onContentTypeSelect) onContentTypeSelect(type);
        setSelectedType(type);
        const key = assistantType === 'MARKETING' ? 'contentType' : assistantType === 'SALES' ? 'taskType' : 'outputType';
        setExtractedParams(prev => ({ ...prev, [key]: type }));
    }

    /* ─── Quick Voice Brief: send transcript directly ── */
    function handleVoiceBriefSend(transcript: string) {
        if (!transcript.trim()) return;
        // Reset voice state without re-entering transcribing mode
        if (voiceTimerRef.current) { clearInterval(voiceTimerRef.current); voiceTimerRef.current = null; }
        setVoiceMode('idle');
        setVoiceSeconds(0);
        setVoiceTranscript('');
        handleSend(transcript);
    }

    /* ─── Render ────────────────────────────────────── */
    return (
        <>
        <div className="aic-container">

            {/* ════════════════════════════════════
                CHAT PANEL
               ════════════════════════════════════ */}
            <div className="aic-chat-panel">

                {/* ── EMPTY STATE: Voice-First Layout ── */}
                {isFirstMessage && !isPostGeneration && (
                    <div className="aic-voice-brief">
                        <div className="aic-voice-brief-inner">

                            {/* ── Voice Hero ── */}
                            {voiceMode === 'idle' && !voiceTranscript && (
                                <div className="aic-voice-action-wrapper">
                                    <div className="aic-voice-action-hero">
                                        <h3>What are we working on today?</h3>
                                    </div>
                                    <button className="aic-voice-hero-btn" onClick={startVoice}>
                                        <Mic size={28} strokeWidth={2} />
                                    </button>
                                    <div className="aic-voice-hero-caption">
                                        <span className="aic-voice-hero-title">Tap to start</span>
                                        <span className="aic-voice-hero-sub">Speak your brief — the assistant will guide you</span>
                                    </div>
                                </div>
                            )}

                            {/* ── Recording State ── */}
                            {voiceMode === 'recording' && (
                                <div className="aic-voice-recording">
                                    <div className="aic-voice-waveform">
                                        {[...Array(8)].map((_, i) => <div key={i} className="aic-wave-bar" />)}
                                    </div>
                                    <span className="aic-voice-timer">{fmtTime(voiceSeconds)}</span>
                                    {voiceTranscript && (
                                        <div className="aic-voice-transcript">{voiceTranscript}</div>
                                    )}
                                    <div className="aic-voice-controls">
                                        <button className="aic-voice-stop-btn" onClick={stopVoice}><Square size={14} strokeWidth={2} /> Stop</button>
                                    </div>
                                </div>
                            )}

                            {/* ── Transcribing State ── */}
                            {voiceMode === 'transcribing' && (
                                <div className="aic-voice-recording">
                                    <div className="aic-voice-waveform" style={{ opacity: 0.4 }}>
                                        {[...Array(8)].map((_, i) => <div key={i} className="aic-wave-bar" />)}
                                    </div>
                                    <span className="aic-voice-timer"><Sparkles size={14} strokeWidth={2} /> Transcribing…</span>
                                    <div className="aic-voice-controls">
                                        <button className="aic-voice-stop-btn" onClick={cancelVoice}><X size={14} strokeWidth={2} /> Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* ── Voice Done State ── */}
                            {voiceTranscript && voiceMode === 'idle' && (
                                <div className="aic-voice-done">
                                    <div className="aic-voice-transcript">{voiceTranscript}</div>
                                    <div className="aic-voice-controls">
                                        <button className="aic-voice-send-btn" onClick={() => handleVoiceBriefSend(voiceTranscript)}>
                                            <Sparkles size={14} strokeWidth={2} /> Send Brief
                                        </button>
                                        <button className="aic-voice-clear-btn" onClick={() => { setVoiceTranscript(''); setInput(''); }}>Clear</button>
                                        <button className="aic-voice-start-btn-sm" onClick={startVoice}><Mic size={14} strokeWidth={2} /> Re-record</button>
                                    </div>
                                </div>
                            )}

                            <p className="aic-voice-or">— or type below —</p>
                        </div>
                    </div>
                )}

                {/* ── MESSAGES ── */}
                {!isFirstMessage && (
                    <div className="aic-messages">
                        {messages.map((msg, i) => {
                            if (msg.isParams) {
                                // Unified ArtifactBubble for ALL assistants
                                return (
                                    <div key={i} className="aic-msg aic-msg--assistant">
                                        <div className="aic-avatar"><Sparkles size={16} strokeWidth={2} /></div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <ArtifactBubble
                                                agentName={assistantType.replace(/_/g, ' ')}
                                                agentRole={contentTypes.find(t => t.value === selectedType)?.label || assistantType.replace(/_/g, ' ')}
                                                state={bubbleState}
                                                metadata={artifactMeta}
                                                missingFields={[]}
                                                progressIndex={artifactProgressIndex}
                                                currentVersion={artifactVersions.length > 0 ? {
                                                    label: `v${artifactVersions[artifactVersions.length - 1].versionNumber}`,
                                                    title: artifactData?.title || result?.title || 'Generating...',
                                                    summary: artifactData?.summary || result?.title || '',
                                                } : undefined}
                                                onGenerate={async () => {
                                                    if (isDesignAssistant) {
                                                        // Design assistants: artifact API flow
                                                        setBubbleState('generating');
                                                        setArtifactProgressIndex(0);
                                                        const t1 = setTimeout(() => setArtifactProgressIndex(1), 800);
                                                        const t2 = setTimeout(() => setArtifactProgressIndex(2), 1600);
                                                        try {
                                                            let artId = artifactId;
                                                            if (!artId) {
                                                                const createRes = await fetch('/api/artifacts', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        sessionId: crypto.randomUUID(),
                                                                        agentId: assistantType,
                                                                        artifactType: artifactMeta.contentType || 'wireframe',
                                                                        title: `${artifactMeta.contentType || 'Wireframe'} — ${artifactMeta.topic || 'Draft'}`,
                                                                        metadata: { ...extractedParams, ...artifactMeta },
                                                                    }),
                                                                });
                                                                if (createRes.ok) {
                                                                    const cd = await createRes.json();
                                                                    artId = cd.artifact.id;
                                                                    setArtifactId(artId!);
                                                                    setArtifactData(cd.artifact);
                                                                } else throw new Error('Failed to create artifact');
                                                            }
                                                            const genRes = await fetch(`/api/artifacts/${artId}/generate`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    prompt: `Create a ${artifactMeta.contentType || 'wireframe'} for ${artifactMeta.topic || 'the page'}. Audience: ${artifactMeta.audience || 'general'}. Goal: ${artifactMeta.goal || 'inform'}.`,
                                                                    metadata: { ...extractedParams, ...artifactMeta },
                                                                }),
                                                            });
                                                            clearTimeout(t1); clearTimeout(t2);
                                                            if (genRes.ok) {
                                                                const gd = await genRes.json();
                                                                setArtifactVersions([gd.version]);
                                                                setArtifactData(gd.artifact);
                                                                setBubbleState('generated');
                                                            } else { setBubbleState('ready'); }
                                                        } catch { clearTimeout(t1); clearTimeout(t2); setBubbleState('ready'); }
                                                    } else {
                                                        // All other assistants: existing onGenerate flow
                                                        setBubbleState('generating');
                                                        setArtifactProgressIndex(0);
                                                        handleGenerateFromParams();
                                                    }
                                                }}
                                                onView={() => setViewerOpen(true)}
                                                onRegenerate={async () => {
                                                    if (isDesignAssistant && artifactId) {
                                                        setBubbleState('generating');
                                                        setArtifactProgressIndex(0);
                                                        const t1 = setTimeout(() => setArtifactProgressIndex(1), 800);
                                                        const t2 = setTimeout(() => setArtifactProgressIndex(2), 1600);
                                                        try {
                                                            const res = await fetch(`/api/artifacts/${artifactId}/generate`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ prompt: `Regenerate ${artifactData?.title}`, metadata: artifactMeta }),
                                                            });
                                                            clearTimeout(t1); clearTimeout(t2);
                                                            if (res.ok) {
                                                                const d = await res.json();
                                                                setArtifactVersions(prev => [...prev, d.version]);
                                                                setArtifactData(d.artifact);
                                                                setBubbleState('generated');
                                                            } else { setBubbleState('ready'); }
                                                        } catch { clearTimeout(t1); clearTimeout(t2); setBubbleState('ready'); }
                                                    } else {
                                                        setBubbleState('generating');
                                                        setArtifactProgressIndex(0);
                                                        onGenerate({ ...extractedParams, contentType: selectedType });
                                                    }
                                                }}
                                                onExport={() => {
                                                    const current = artifactVersions[artifactVersions.length - 1];
                                                    if (current?.outputPayload) {
                                                        const payload = current.outputPayload;
                                                        const isText = payload.type === 'text';
                                                        const blob = new Blob(
                                                            [isText ? (payload.content || '') : JSON.stringify(payload, null, 2)],
                                                            { type: isText ? 'text/markdown' : 'application/json' }
                                                        );
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `${artifactData?.title || 'artifact'}.${isText ? 'md' : 'json'}`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            }
                            if (msg.isParams) return null;
                            return (
                                <div key={i} className={`aic-msg aic-msg--${msg.role}`}>
                                    {msg.role === 'assistant' && <div className="aic-avatar"><Sparkles size={16} strokeWidth={2} /></div>}
                                    <div className="aic-msg-col">
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="aic-msg-attachments">
                                                {msg.attachments.map(a => (
                                                    <div key={a.id} className={`aic-attach-chip aic-attach-chip--${msg.role}`}>
                                                        {a.preview
                                                            ? <img src={a.preview} alt={a.name} className="aic-attach-thumb" />
                                                            : <span>{a.type === 'doc' ? <FileText size={14} strokeWidth={2} /> : <Paperclip size={14} strokeWidth={2} />}</span>}
                                                        <span className="aic-attach-name">{a.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="aic-bubble md-content">
                                            {msg.resultEnvelope ? (
                                                <RuntimeResultRenderer envelope={msg.resultEnvelope} />
                                            ) : (
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            )}
                                        </div>
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="aic-avatar aic-avatar--user">
                                            {userAvatar
                                                ? <img src={userAvatar} alt="" className="aic-avatar-img" />
                                                : <User size={16} strokeWidth={2} />}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Dead inline result card removed — artifact bubble handles all output rendering */}



                        {generating && !isPostGeneration && (
                            <div className="aic-msg aic-msg--assistant">
                                <div className="aic-avatar"><Sparkles size={16} strokeWidth={2} /></div>
                                <div className="aic-generating-bubble">
                                    <div className="aic-spinner" />
                                    <span>{loadingSteps[loadingStep]}</span>
                                </div>
                            </div>
                        )}

                        {chatLoading && (
                            <div className="aic-msg aic-msg--assistant">
                                <div className="aic-avatar"><Sparkles size={16} strokeWidth={2} /></div>
                                <div className="aic-thinking"><span /><span /><span /></div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
                {isFirstMessage && <div ref={messagesEndRef} />}

                {/* ── DOCUMENT PICKER DROPDOWN ── */}
                {showDocPicker && (
                    <div className="aic-doc-picker">
                        {workspaceDocs.length === 0 ? (
                            <p className="aic-doc-empty">No workspace documents found.</p>
                        ) : (
                            workspaceDocs.map(doc => {
                                const selected = attachments.some(a => a.docId === doc.id);
                                return (
                                    <label key={doc.id} className={`aic-doc-item ${selected ? 'selected' : ''}`}>
                                        <input type="checkbox" checked={selected} onChange={() => toggleDocAttachment(doc)} />
                                        <span className="aic-doc-name"><FileText size={14} strokeWidth={2} /> {doc.filename}</span>
                                        <span className="aic-doc-size">{fmtSize(doc.size)}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                )}

                {/* ── IN-CHAT VOICE RECORDING BAR ── */}
                {(voiceMode === 'recording' || voiceMode === 'transcribing') && !isFirstMessage && (
                    <div className="aic-inline-voice">
                        <div className="aic-voice-waveform" style={voiceMode === 'transcribing' ? { opacity: 0.4 } : undefined}>
                            {[...Array(6)].map((_, i) => <div key={i} className="aic-wave-bar" />)}
                        </div>
                        <span className="aic-voice-timer">
                            {voiceMode === 'transcribing' ? <><Sparkles size={14} strokeWidth={2} /> Transcribing…</> : fmtTime(voiceSeconds)}
                        </span>
                        {voiceMode === 'recording' && (
                            <button className="aic-voice-stop-sm" onClick={stopVoice}><Square size={14} strokeWidth={2} /> Stop</button>
                        )}
                        {voiceMode === 'transcribing' && (
                            <button className="aic-voice-stop-sm" onClick={cancelVoice}><X size={14} strokeWidth={2} /> Cancel</button>
                        )}
                    </div>
                )}

                {/* ═══ ChatGPT-style Input Bar ═══ */}
                <div className="aic-chatbar-wrapper">
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv"
                        style={{ display: 'none' }}
                        onChange={e => handleFileSelect(e.target.files)}
                    />

                    <div className={`aic-chatbar ${(voiceMode === 'recording' || voiceMode === 'transcribing') && !isFirstMessage ? 'aic-chatbar--recording' : ''}`}>
                        {/* Attachment chips inside the bar */}
                        {attachments.length > 0 && (
                            <div className="aic-chatbar-attachments">
                                {attachments.map(a => (
                                    <div key={a.id} className="aic-attach-chip">
                                        {a.preview
                                            ? <img src={a.preview} alt={a.name} className="aic-attach-thumb" />
                                            : <span>{a.type === 'doc' ? <FileText size={14} strokeWidth={2} /> : <Paperclip size={14} strokeWidth={2} />}</span>}
                                        <span className="aic-attach-name">{a.name}</span>
                                        <button className="aic-attach-remove" onClick={() => removeAttachment(a.id)}><X size={12} strokeWidth={2} /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="aic-chatbar-row">
                            {/* + Attach button */}
                            <button
                                className={`aic-chatbar-plus ${showDocPicker ? 'active' : ''}`}
                                title="Attach files or documents"
                                onClick={() => {
                                    setShowDocPicker(p => !p);
                                    fileInputRef.current?.click();
                                }}
                                disabled={chatLoading || generating}
                            >
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                            </button>

                            {/* Content Type Selector (inline chip in chat bar) */}
                            {contentTypes.length > 0 && !isPostGeneration && (
                                <div className="aic-chatbar-type-wrapper">
                                    <select
                                        className="aic-chatbar-type-select"
                                        value={selectedType}
                                        onChange={(e) => handleTypeChange(e.target.value)}
                                        disabled={chatLoading || generating}
                                    >
                                        <option value="">Type ▾</option>
                                        {contentTypes.map(ct => (
                                            <option key={ct.value} value={ct.value}>{ct.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Textarea input */}
                            <textarea
                                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                                className="aic-chatbar-textarea"
                                value={input}
                                onChange={e => {
                                    setInput(e.target.value);
                                    // Auto-grow
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                                }}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder={
                                    voiceMode === 'recording'
                                        ? 'Listening…'
                                        : isPostGeneration
                                            ? 'Ask to refine… e.g. "make it shorter"'
                                            : 'Describe what you need...'
                                }
                                disabled={chatLoading || generating || voiceMode === 'recording'}
                                rows={1}
                            />

                            {/* Mic button */}
                            {!isFirstMessage && (
                                <button
                                    className={`aic-chatbar-icon-btn aic-chatbar-mic ${voiceMode !== 'idle' ? 'active' : ''}`}
                                    title={voiceMode === 'recording' ? 'Stop recording' : voiceMode === 'transcribing' ? 'Transcribing…' : 'Voice input'}
                                    onClick={voiceMode === 'recording' ? stopVoice : startVoice}
                                    disabled={chatLoading || generating || voiceMode === 'transcribing'}
                                >
                                    {voiceMode === 'transcribing' ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                    ) : voiceMode === 'recording' ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" fill="currentColor"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                                    )}
                                </button>
                            )}

                            {/* Send button */}
                            <button
                                className="aic-chatbar-send"
                                onClick={() => handleSend()}
                                disabled={!input.trim() || chatLoading || generating || voiceMode !== 'idle'}
                                title="Send"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Hints removed — ArtifactBubble handles readiness state */}
            </div>
        </div>

            {/* ── ARTIFACT VIEWER MODAL (All assistants) ── */}
            {viewerOpen && artifactData && (
                <ArtifactViewer
                    artifact={artifactData}
                    versions={artifactVersions}
                    onClose={() => setViewerOpen(false)}
                    onIterate={async (prompt, scopeType, selectedArea) => {
                        if (!artifactId) return;
                        setIsIterating(true);
                        try {
                            const res = await fetch(`/api/artifacts/${artifactId}/iterate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt, scopeType, selectedArea, parentVersionId: artifactData.currentVersionId }),
                            });
                            if (res.ok) {
                                const data = await res.json();
                                setArtifactVersions(prev => [...prev, data.version]);
                                setArtifactData((prev: any) => ({ ...prev, currentVersionId: data.version.id }));
                            }
                        } catch { /* handled */ }
                        setIsIterating(false);
                    }}
                    onRegenerate={async () => {
                        if (!artifactId) return;
                        setBubbleState('generating');
                        setArtifactProgressIndex(0);
                        setViewerOpen(false);
                        const t1 = setTimeout(() => setArtifactProgressIndex(1), 800);
                        const t2 = setTimeout(() => setArtifactProgressIndex(2), 1600);
                        try {
                            const res = await fetch(`/api/artifacts/${artifactId}/generate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt: `Regenerate ${artifactData.title}`, metadata: artifactMeta }),
                            });
                            clearTimeout(t1); clearTimeout(t2);
                            if (res.ok) {
                                const d = await res.json();
                                setArtifactVersions(prev => [...prev, d.version]);
                                setArtifactData(d.artifact);
                                setBubbleState('generated');
                            } else { setBubbleState('ready'); }
                        } catch { clearTimeout(t1); clearTimeout(t2); setBubbleState('ready'); }
                    }}
                    onExport={() => {
                        const current = artifactVersions[artifactVersions.length - 1];
                        if (current?.outputPayload) {
                            const blob = new Blob([JSON.stringify(current.outputPayload, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = `${artifactData?.title || 'artifact'}.json`; a.click();
                            URL.revokeObjectURL(url);
                        }
                    }}
                    isIterating={isIterating}
                />
            )}

            {/* ── Newsletter Preview Modal ────────────────── */}
            {previewContent && (
                <div className="newsletter-overlay" onClick={() => setPreviewContent(null)}>
                    <div className="newsletter-modal" ref={newsletterRef} onClick={e => e.stopPropagation()}>
                        <div className="newsletter-header">
                            <div className="newsletter-header-left">
                                <span className="newsletter-badge">AI GENERATED</span>
                                <span className="newsletter-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                            <button className="newsletter-close-btn" onClick={() => setPreviewContent(null)}><X size={18} /></button>
                        </div>
                        {previewContent.title && (
                            <h1 className="newsletter-title">{previewContent.title}</h1>
                        )}
                        <div className="newsletter-divider" />
                        <div className="newsletter-content md-content">
                            <ReactMarkdown>{previewContent.content}</ReactMarkdown>
                        </div>
                        {/* ── Action Bar inside Preview ── */}
                        <div className="newsletter-toolbar">
                            <button className="aic-action-btn" onClick={() => onCopy(previewContent.content)}><ClipboardCopy size={14} strokeWidth={2} /> COPY</button>
                            <div className="newsletter-share-wrapper">
                                <button className="aic-action-btn" onClick={(e) => {
                                    e.stopPropagation();
                                    const menu = (e.currentTarget.parentElement as HTMLElement)?.querySelector('.newsletter-export-menu');
                                    menu?.classList.toggle('open');
                                }}><Download size={14} strokeWidth={2} /> EXPORT</button>
                                <div className="newsletter-export-menu newsletter-share-menu">
                                    <button className="newsletter-share-option" onClick={() => {
                                        onExport(previewContent.content, previewContent.title);
                                        document.querySelector('.newsletter-export-menu')?.classList.remove('open');
                                    }}>
                                        <FileText size={14} strokeWidth={2} className="newsletter-share-icon" /> Markdown (.md)
                                    </button>
                                    <button className="newsletter-share-option" onClick={async () => {
                                        try {
                                            const pdfBlob = await generatePreviewPdf();
                                            if (!pdfBlob) return;
                                            const fileName = `${previewContent.title || 'document'}.pdf`;
                                            const url = URL.createObjectURL(pdfBlob);
                                            const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
                                            URL.revokeObjectURL(url);
                                        } catch { /* error */ }
                                        document.querySelector('.newsletter-export-menu')?.classList.remove('open');
                                    }}>
                                        <FileDown size={14} strokeWidth={2} className="newsletter-share-icon" /> PDF (.pdf)
                                    </button>
                                </div>
                            </div>
                            <div className="newsletter-share-wrapper">
                                <button className="aic-action-btn newsletter-share-trigger" onClick={(e) => {
                                    e.stopPropagation();
                                    const menu = (e.currentTarget.parentElement as HTMLElement)?.querySelector('.newsletter-share-menu');
                                    menu?.classList.toggle('open');
                                }}><Share2 size={14} strokeWidth={2} /> SHARE</button>
                                <div className="newsletter-share-menu">
                                    <button className="newsletter-share-option" onClick={async () => {
                                        try {
                                            const pdfBlob = await generatePreviewPdf();
                                            if (!pdfBlob) return;
                                            const fileName = `${previewContent.title || 'document'}.pdf`;
                                            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                                            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                                                await navigator.share({ title: previewContent.title, files: [file] });
                                            } else {
                                                const url = URL.createObjectURL(pdfBlob);
                                                const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
                                                URL.revokeObjectURL(url);
                                                window.open('https://wa.me/', '_blank');
                                            }
                                        } catch { /* cancelled */ }
                                    }}>
                                        <MessageCircle size={14} strokeWidth={2} className="newsletter-share-icon" /> WhatsApp
                                    </button>
                                    <button className="newsletter-share-option" onClick={async () => {
                                        try {
                                            const pdfBlob = await generatePreviewPdf();
                                            if (!pdfBlob) return;
                                            const fileName = `${previewContent.title || 'document'}.pdf`;
                                            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                                            if (navigator.share && navigator.canShare?.({ files: [file] })) {
                                                await navigator.share({ title: previewContent.title, files: [file] });
                                            } else {
                                                const url = URL.createObjectURL(pdfBlob);
                                                const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
                                                URL.revokeObjectURL(url);
                                                window.open(`mailto:?subject=${encodeURIComponent(previewContent.title)}&body=${encodeURIComponent('Please find the attached document.')}`, '_blank');
                                            }
                                        } catch { /* cancelled */ }
                                    }}>
                                        <Mail size={14} strokeWidth={2} className="newsletter-share-icon" /> Email
                                    </button>
                                    <button className="newsletter-share-option" onClick={() => {
                                        const text = encodeURIComponent(previewContent.content.substring(0, 300));
                                        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=&summary=${text}`, '_blank');
                                    }}>
                                        <Briefcase size={14} strokeWidth={2} className="newsletter-share-icon" /> LinkedIn
                                    </button>
                                    {typeof navigator !== 'undefined' && navigator.share && (
                                        <button className="newsletter-share-option" onClick={async () => {
                                            try {
                                                const pdfBlob = await generatePreviewPdf();
                                                if (!pdfBlob) return;
                                                const fileName = `${previewContent.title || 'document'}.pdf`;
                                                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                                                await navigator.share({ title: previewContent.title, files: [file] });
                                            } catch { /* cancelled */ }
                                        }}>
                                            <ExternalLink size={14} strokeWidth={2} className="newsletter-share-icon" /> More...
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        {/* ── External Actions inside Preview ── */}
                        {skillActions.length > 0 && !generating && (
                            <div className="newsletter-actions">
                                <div className="newsletter-actions-header">
                                    <Zap size={14} strokeWidth={2} />
                                    <span>EXTERNAL ACTIONS</span>
                                </div>
                                <div className="newsletter-actions-grid">
                                    {skillActions.map(action => (
                                        <button
                                            key={action.id}
                                            className="newsletter-action-btn"
                                            onClick={(e) => { e.stopPropagation(); openActionModal(action); }}
                                        >
                                            <Zap size={14} strokeWidth={2} className="newsletter-action-icon" />
                                            <span className="newsletter-action-name">{action.name}</span>
                                            <span className="newsletter-action-app">{action.serviceApp}</span>
                                            <ArrowRight size={14} strokeWidth={2} className="newsletter-action-arrow" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="newsletter-footer">
                            <span>Generated by Nousio AI</span>
                            <span>{assistantType.replace('_', ' ')}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── External Action Execution Modal ────────── */}
            {executingAction && (() => {
                const schema = typeof executingAction.inputSchema === 'string' ? JSON.parse(executingAction.inputSchema) : executingAction.inputSchema;
                const props = schema?.properties || {};
                const requiredFields: string[] = schema?.required || [];
                const fieldKeys = Object.keys(props);

                return (
                <div className="aic-execute-backdrop" onClick={() => { if (!executeLoading) setExecutingAction(null); }}>
                    <div className="aic-execute-modal" onClick={e => e.stopPropagation()}>
                        <div className="aic-execute-header">
                            <Zap size={18} strokeWidth={2} style={{ color: '#ff6d00' }} />
                            <span>{executingAction.name}</span>
                            <button className="aic-execute-close" onClick={() => setExecutingAction(null)} disabled={executeLoading}>
                                <X size={16} />
                            </button>
                        </div>

                        <div className="aic-execute-body">
                            <div className="aic-execute-info">
                                <span className="aic-execute-label">Service</span>
                                <span className="aic-execute-value">{executingAction.serviceApp} via Zapier</span>
                            </div>

                            {/* Dynamic form fields from inputSchema */}
                            {fieldKeys.length > 0 ? (
                                fieldKeys.map(key => {
                                    const prop = props[key];
                                    const label = prop.title || key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                                    const isRequired = requiredFields.includes(key);
                                    const isLong = (prop.description || '').toLowerCase().includes('body') ||
                                        key.toLowerCase().includes('body') || key.toLowerCase().includes('message') ||
                                        key.toLowerCase().includes('content') || key.toLowerCase().includes('text');

                                    return (
                                        <div key={key} className="aic-execute-field">
                                            <label className="aic-execute-label">
                                                {label} {isRequired && <span style={{ color: '#ff6d00' }}>*</span>}
                                            </label>
                                            {prop.description && <span className="aic-execute-hint">{prop.description}</span>}
                                            {isLong ? (
                                                <textarea
                                                    className="aic-execute-textarea"
                                                    value={actionParams[key] || ''}
                                                    onChange={e => setActionParams(p => ({ ...p, [key]: e.target.value }))}
                                                    rows={5}
                                                    disabled={executeLoading}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    className="aic-execute-input"
                                                    value={actionParams[key] || ''}
                                                    onChange={e => setActionParams(p => ({ ...p, [key]: e.target.value }))}
                                                    disabled={executeLoading}
                                                />
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="aic-execute-info">
                                    <span className="aic-execute-label">Content</span>
                                    <div className="aic-execute-preview">
                                        <strong>{result?.title}</strong>
                                        <p>{result?.content?.substring(0, 300)}...</p>
                                    </div>
                                </div>
                            )}

                            <p className="aic-execute-note">
                                This will execute &quot;{executingAction.name}&quot; with the parameters above.
                            </p>
                        </div>

                        {executeResult && (
                            <div className={`aic-execute-result ${executeResult.success ? 'success' : 'error'}`}>
                                {executeResult.success ? <CircleCheck size={16} /> : <AlertTriangle size={16} />}
                                <span>{executeResult.message}</span>
                            </div>
                        )}

                        <div className="aic-execute-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setExecutingAction(null)}
                                disabled={executeLoading}
                            >
                                {executeResult?.success ? 'Close' : 'Cancel'}
                            </button>
                            {!executeResult?.success && (
                                <button
                                    className="aic-execute-btn"
                                    onClick={() => handleExecuteAction(executingAction)}
                                    disabled={executeLoading}
                                >
                                    {executeLoading ? (
                                        <><Loader size={14} className="aic-spin" /> Executing...</>
                                    ) : (
                                        <><Zap size={14} /> Execute Action</>
                                    )}
                                </button>
                            )}
                        </div>
                        <div className="aic-execute-attribution">Powered by Zapier</div>
                    </div>
                </div>
                );
            })()}
            {/* ── Code Preview Fullscreen Overlay ────────────── */}
            {codePreviewOpen && result?.content && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 99999, background: '#0f172a',
                    display: 'flex', flexDirection: 'column',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 20px',
                        background: '#0f172a', borderBottom: '2px solid #1e293b',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Eye size={16} style={{ color: '#60a5fa' }} />
                            <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em' }}>UI Preview — {result.title || 'Generated Output'}</span>
                        </div>
                        <button
                            onClick={() => setCodePreviewOpen(false)}
                            style={{
                                background: '#ef4444', color: '#fff', border: '2px solid #fff',
                                padding: '6px 18px', fontWeight: 800, fontSize: 11,
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                            }}
                        >
                            <Minimize2 size={12} /> Close
                        </button>
                    </div>
                    <div style={{ flex: 1, background: '#fff' }}>
                        <iframe
                            srcDoc={buildPreviewHtml(result.content)}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            sandbox="allow-scripts allow-same-origin allow-modals"
                            title="UI Preview"
                        />
                    </div>
                </div>
            )}
        </>
    );
}

