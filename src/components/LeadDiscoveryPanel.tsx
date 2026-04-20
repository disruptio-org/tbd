'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUIFeedback } from '@/components/UIFeedback';
import SmartInput from '@/components/SmartInput';
import VoiceRantBrief from '@/components/VoiceRantBrief';
import WorkspaceSelector, { ProjectWorkspace } from '@/components/WorkspaceSelector';
import {
    Search, ClipboardList, Clock, Building2, BarChart3, FolderOpen, Rocket,
    SearchCheck, Save, Download, RefreshCw, Tag, MapPin, Globe, Eye, Trash2,
    Target, Lightbulb, User, Link as LinkIcon,
} from 'lucide-react';
import '@/app/(dashboard)/leads/leads.css';

// ─── Types ────────────────────────────────────────────

interface LeadResult {
    id: string;
    companyName: string;
    website: string | null;
    industry: string | null;
    location: string | null;
    summary: string | null;
    whyFit: string | null;
    suggestedApproach: string | null;
    likelyContactRoles: string[];
    sourceLinks: Array<{ title: string; url: string }>;
    relevanceScore: number | null;
}

interface SearchRun {
    id: string;
    title: string | null;
    query: string;
    status: string;
    searchContext: Record<string, unknown> | null;
    createdAt: string;
    resultCount: number;
}

interface SavedList {
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
    itemCount: number;
}

interface CompanyProfile {
    productsServices?: string;
    targetCustomers?: string;
    markets?: string;
    valueProposition?: string;
    targetIndustries?: string;
    companyName?: string;
    industry?: string;
}

// ─── Loading Steps ────────────────────────────────────

const LOADING_STEPS = [
    'Analyzing company profile…',
    'Searching the web…',
    'Evaluating lead relevance…',
    'Preparing results list…',
];

const LEADS_VOICE_SCHEMA: Record<string, string> = {
    query: 'string - the main discovery objective / what kind of leads to find',
    productsServices: 'string - products and services we sell',
    targetCustomers: 'string - description of target customer profile',
    industry: 'string - sector or industry to target',
    geography: 'string - country or region to search in',
    markets: 'string - markets to focus on',
    companySize: 'enum: startup | small | SME | mid | large — company size filter',
    desiredLeadCount: 'number (1-20) - how many leads to find',
    mustHaveCriteria: 'string - required criteria for leads',
    excludeCriteria: 'string - criteria to exclude from results',
};

// ─── Component ────────────────────────────────────────

export default function LeadDiscoveryPanel() {
    const { showToast, showConfirm } = useUIFeedback();

    // Tabs
    const [activeTab, setActiveTab] = useState<'discover' | 'lists' | 'history'>('discover');

    // Company profile context
    const [profile, setProfile] = useState<CompanyProfile | null>(null);
    const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);

    // Form state
    const [form, setForm] = useState({
        query: '',
        productsServices: '',
        targetCustomers: '',
        markets: '',
        industry: '',
        geography: '',
        companySize: '',
        desiredLeadCount: 10,
        mustHaveCriteria: '',
        excludeCriteria: '',
    });

    // Discovery state
    const [discovering, setDiscovering] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [results, setResults] = useState<LeadResult[]>([]);
    const [currentRunId, setCurrentRunId] = useState<string | null>(null);

    // Modal
    const [selectedLead, setSelectedLead] = useState<LeadResult | null>(null);

    // Lists & History
    const [lists, setLists] = useState<SavedList[]>([]);
    const [runs, setRuns] = useState<SearchRun[]>([]);
    const [listsLoading, setListsLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Save dialog
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveListName, setSaveListName] = useState('');
    const [saveListDesc, setSaveListDesc] = useState('');

    // ─── Load Company Profile ─────────────────────────

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        try {
            const res = await fetch('/api/company/profile');
            const data = await res.json();
            if (data.profile) {
                const p = data.profile;
                setProfile(p);
                setForm(prev => ({
                    ...prev,
                    productsServices: p.productsServices || '',
                    targetCustomers: p.targetCustomers || '',
                    markets: p.markets || '',
                }));
            }
        } catch {
            console.error('Failed to load profile');
        }
    }

    // ─── Load Lists ───────────────────────────────────

    const loadLists = useCallback(async () => {
        setListsLoading(true);
        try {
            const res = await fetch('/api/leads/lists');
            if (res.ok) {
                const data = await res.json();
                setLists(data.lists || []);
            }
        } catch {
            console.error('Failed to load lists');
        }
        setListsLoading(false);
    }, []);

    // ─── Load History ─────────────────────────────────

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch('/api/leads/runs');
            if (res.ok) {
                const data = await res.json();
                setRuns(data.runs || []);
            }
        } catch {
            console.error('Failed to load history');
        }
        setHistoryLoading(false);
    }, []);

    useEffect(() => {
        if (activeTab === 'lists') loadLists();
        if (activeTab === 'history') loadHistory();
    }, [activeTab, loadLists, loadHistory]);

    // ─── Discovery ────────────────────────────────────

    async function handleDiscover() {
        if (!form.query.trim()) {
            showToast('Define what you are looking for before starting the search', 'error');
            return;
        }

        setDiscovering(true);
        setResults([]);
        setLoadingStep(0);
        setCurrentRunId(null);

        // Animate loading steps
        const stepInterval = setInterval(() => {
            setLoadingStep(prev => Math.min(prev + 1, LOADING_STEPS.length - 1));
        }, 3000);

        try {
            const res = await fetch('/api/leads/discover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, projectId: workspace?.id }),
            });
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                setResults(data.results);
                setCurrentRunId(data.searchRunId);
                showToast(`${data.results.length} leads found!`, 'success');
            } else if (data.error) {
                showToast(data.error, 'error');
            } else {
                showToast('No leads found. Try adjusting the criteria.', 'error');
            }
        } catch {
            showToast('Connection error to discovery service', 'error');
        }

        clearInterval(stepInterval);
        setDiscovering(false);
    }

    // ─── Export ────────────────────────────────────────

    async function handleExport(searchRunId?: string, leadListId?: string) {
        try {
            const res = await fetch('/api/leads/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ searchRunId, leadListId }),
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('CSV exported successfully!', 'success');
            } else {
                showToast('Error exporting', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
    }

    // ─── Save to List ─────────────────────────────────

    async function handleSaveToList() {
        if (!saveListName.trim()) {
            showToast('List name is required', 'error');
            return;
        }

        try {
            const res = await fetch('/api/leads/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: saveListName,
                    description: saveListDesc,
                    sourceSearchRunId: currentRunId,
                    leadResultIds: results.map(r => r.id),
                }),
            });

            if (res.ok) {
                showToast('List saved successfully!', 'success');
                setShowSaveDialog(false);
                setSaveListName('');
                setSaveListDesc('');
            } else {
                showToast('Error saving list', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
    }

    // ─── Delete List ──────────────────────────────────

    function handleDeleteList(listId: string, listName: string) {
        showConfirm(`Delete the list "${listName}"?`, async () => {
            try {
                const res = await fetch(`/api/leads/lists/${listId}`, { method: 'DELETE' });
                if (res.ok) {
                    setLists(prev => prev.filter(l => l.id !== listId));
                    showToast('List deleted', 'success');
                }
            } catch {
                showToast('Error deleting', 'error');
            }
        });
    }

    // ─── Load Run Results ─────────────────────────────

    async function loadRunResults(runId: string) {
        try {
            const res = await fetch(`/api/leads/runs/${runId}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.results || []);
                setCurrentRunId(runId);
                setActiveTab('discover');
                showToast('Results loaded', 'success');
            }
        } catch {
            showToast('Error loading results', 'error');
        }
    }

    // ─── Delete Run ───────────────────────────────────

    function handleDeleteRun(runId: string) {
        showConfirm('Delete this search and its results?', async () => {
            try {
                const res = await fetch(`/api/leads/runs/${runId}`, { method: 'DELETE' });
                if (res.ok) {
                    setRuns(prev => prev.filter(r => r.id !== runId));
                    showToast('Search deleted', 'success');
                }
            } catch {
                showToast('Error deleting', 'error');
            }
        });
    }

    // ─── Score styling ────────────────────────────────

    function scoreClass(score: number | null): string {
        if (!score) return 'low';
        if (score >= 70) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    // ─── Render ───────────────────────────────────────

    return (
        <div className="leads-page">
            {/* Sub-tabs for lead discovery */}
            <div className="leads-tabs">
                <button
                    className={`leads-tab ${activeTab === 'discover' ? 'active' : ''}`}
                    onClick={() => setActiveTab('discover')}
                >
                    <Search size={14} strokeWidth={2} /> Discover
                    {results.length > 0 && (
                        <span className="leads-tab-badge">{results.length}</span>
                    )}
                </button>
                <button
                    className={`leads-tab ${activeTab === 'lists' ? 'active' : ''}`}
                    onClick={() => setActiveTab('lists')}
                >
                    <ClipboardList size={14} strokeWidth={2} /> Saved Lists
                </button>
                <button
                    className={`leads-tab ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    <Clock size={14} strokeWidth={2} /> History
                </button>
            </div>

            {/* ─── Discover Tab ──────────────────────── */}
            {activeTab === 'discover' && (
                <>
                    {/* Discovery Form + Context Panel */}
                    {!discovering && results.length === 0 && (
                        <div className="leads-discover-layout">
                            {/* Workspace Selector */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <WorkspaceSelector
                                    selectedId={workspace?.id}
                                    onSelect={setWorkspace}
                                />
                            </div>

                            {/* Voice Rant Brief */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <VoiceRantBrief
                                    projectId={workspace?.id}
                                    assistantType="LEAD_DISCOVERY"
                                    fieldSchema={LEADS_VOICE_SCHEMA}
                                    onAutoFill={(fields) => {
                                        setForm(prev => ({
                                            ...prev,
                                            ...(fields.query && { query: fields.query }),
                                            ...(fields.productsServices && { productsServices: fields.productsServices }),
                                            ...(fields.targetCustomers && { targetCustomers: fields.targetCustomers }),
                                            ...(fields.industry && { industry: fields.industry }),
                                            ...(fields.geography && { geography: fields.geography }),
                                            ...(fields.markets && { markets: fields.markets }),
                                            ...(fields.companySize && { companySize: fields.companySize }),
                                            ...(fields.desiredLeadCount && { desiredLeadCount: Math.min(20, Math.max(1, Number(fields.desiredLeadCount) || 10)) }),
                                            ...(fields.mustHaveCriteria && { mustHaveCriteria: fields.mustHaveCriteria }),
                                            ...(fields.excludeCriteria && { excludeCriteria: fields.excludeCriteria }),
                                        }));
                                    }}
                                    disabled={discovering}
                                />
                            </div>
                            <div className="leads-form-panel">
                                <h2 className="leads-form-title"><SearchCheck size={16} strokeWidth={2} /> Define Lead Search</h2>
                                <div className="leads-form-grid">
                                    <div className="leads-form-group full-width">
                                        <label htmlFor="ld-query">Discovery Objective *</label>
                                        <SmartInput
                                            id="ld-query"
                                            value={form.query}
                                            onChange={v => setForm(p => ({ ...p, query: v }))}
                                            placeholder="E.g.: Find SMBs in Portugal in logistics that could benefit from AI process automation"
                                            rows={3}
                                            multiline
                                            brainType="LEAD_DISCOVERY"
                                            fieldLabel="Discovery Objective"
                                        />
                                    </div>

                                    <div className="leads-form-group full-width">
                                        <label htmlFor="ld-products">Products / Services we sell</label>
                                        <SmartInput
                                            id="ld-products"
                                            value={form.productsServices}
                                            onChange={v => setForm(p => ({ ...p, productsServices: v }))}
                                            placeholder="Describe what your company offers..."
                                            rows={2}
                                            multiline
                                            brainType="LEAD_DISCOVERY"
                                            fieldLabel="Products / Services we sell"
                                        />
                                    </div>

                                    <div className="leads-form-group full-width">
                                        <label htmlFor="ld-target">Target Customers</label>
                                        <SmartInput
                                            id="ld-target"
                                            value={form.targetCustomers}
                                            onChange={v => setForm(p => ({ ...p, targetCustomers: v }))}
                                            placeholder="Describe the profile of your ideal customers..."
                                            rows={2}
                                            multiline
                                            brainType="LEAD_DISCOVERY"
                                            fieldLabel="Target Customers"
                                        />
                                    </div>

                                    <div className="leads-form-group">
                                        <label htmlFor="ld-industry">Sector / Industry</label>
                                        <SmartInput
                                            id="ld-industry"
                                            value={form.industry}
                                            onChange={v => setForm(p => ({ ...p, industry: v }))}
                                            placeholder="E.g.: Logistics, Healthcare, Consulting"
                                            brainType="LEAD_DISCOVERY"
                                            fieldLabel="Sector / Industry"
                                        />
                                    </div>

                                    <div className="leads-form-group">
                                        <label htmlFor="ld-geo">Country / Region</label>
                                        <SmartInput
                                            id="ld-geo"
                                            value={form.geography}
                                            onChange={v => setForm(p => ({ ...p, geography: v }))}
                                            placeholder="E.g.: Portugal, Lisbon, Europe"
                                            brainType="LEAD_DISCOVERY"
                                            fieldLabel="Country / Region"
                                        />
                                    </div>

                                    <div className="leads-form-group">
                                        <label htmlFor="ld-markets">Markets</label>
                                        <SmartInput
                                            id="ld-markets"
                                            value={form.markets}
                                            onChange={v => setForm(p => ({ ...p, markets: v }))}
                                            placeholder="E.g.: Portugal, Brazil, Europe"
                                            brainType="LEAD_DISCOVERY"
                                            fieldLabel="Markets"
                                        />
                                    </div>

                                    <div className="leads-form-group">
                                        <label htmlFor="ld-size">Company Size</label>
                                        <select
                                            id="ld-size"
                                            value={form.companySize}
                                            onChange={e => setForm(p => ({ ...p, companySize: e.target.value }))}
                                        >
                                            <option value="">Any</option>
                                            <option value="startup">Startup (1-10)</option>
                                            <option value="small">Small (11-50)</option>
                                            <option value="SME">SME (51-250)</option>
                                            <option value="mid">Mid-size (251-1000)</option>
                                            <option value="large">Large (1000+)</option>
                                        </select>
                                    </div>

                                    <div className="leads-form-group">
                                        <label htmlFor="ld-count">Number of Leads</label>
                                        <input
                                            id="ld-count"
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={form.desiredLeadCount}
                                            onChange={e => setForm(p => ({ ...p, desiredLeadCount: Number(e.target.value) || 10 }))}
                                        />
                                    </div>

                                    <div className="leads-form-group full-width">
                                        <label htmlFor="ld-must">Required Criteria</label>
                                        <SmartInput
                                            id="ld-must"
                                            value={form.mustHaveCriteria}
                                            onChange={v => setForm(p => ({ ...p, mustHaveCriteria: v }))}
                                            placeholder="E.g.: Company with website, more than 50 employees..."
                                            rows={2}
                                            multiline
                                            brainType="LEAD_DISCOVERY"
                                            fieldLabel="Required Criteria"
                                        />
                                    </div>

                                    <div className="leads-form-group full-width">
                                        <label htmlFor="ld-exclude">Exclusion Criteria</label>
                                        <SmartInput
                                            id="ld-exclude"
                                            value={form.excludeCriteria}
                                            onChange={v => setForm(p => ({ ...p, excludeCriteria: v }))}
                                            placeholder="E.g.: Already contacted companies, direct competitors..."
                                            rows={2}
                                            multiline
                                            brainType="LEAD_DISCOVERY"
                                            fieldLabel="Exclusion Criteria"
                                        />
                                    </div>
                                </div>

                                <div className="leads-form-footer">
                                    <button className="btn btn-primary" onClick={handleDiscover}>
                                        <Rocket size={14} strokeWidth={2} /> Discover Leads
                                    </button>
                                </div>
                            </div>

                            {/* Context Panel */}
                            <div className="leads-context-panel">
                                {workspace ? (
                                    <>
                                        <h3 className="leads-context-title"><FolderOpen size={16} strokeWidth={2} /> Project Context</h3>
                                        <div className="leads-context-items">
                                            <div className="leads-context-item">
                                                <span className="leads-context-label">Project</span>
                                                <span className="leads-context-value">{workspace.name}</span>
                                            </div>
                                            <hr className="leads-context-divider" />
                                            {workspace.description && (
                                                <>
                                                    <div className="leads-context-item">
                                                        <span className="leads-context-label">Description</span>
                                                        <span className="leads-context-value">{workspace.description}</span>
                                                    </div>
                                                    <hr className="leads-context-divider" />
                                                </>
                                            )}
                                            {workspace.contextText && (
                                                <div className="leads-context-item">
                                                    <span className="leads-context-label">Instructions</span>
                                                    <span className="leads-context-value">
                                                        {workspace.contextText.substring(0, 150) + (workspace.contextText.length > 150 ? '…' : '')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="leads-context-title"><Building2 size={16} strokeWidth={2} /> Company Context</h3>
                                        <div className="leads-context-items">
                                            <div className="leads-context-item">
                                                <span className="leads-context-label">Company</span>
                                                <span className={`leads-context-value ${!profile?.companyName ? 'empty' : ''}`}>
                                                    {profile?.companyName || 'Not defined'}
                                                </span>
                                            </div>
                                            <hr className="leads-context-divider" />
                                            <div className="leads-context-item">
                                                <span className="leads-context-label">Services</span>
                                                <span className={`leads-context-value ${!profile?.productsServices ? 'empty' : ''}`}>
                                                    {profile?.productsServices
                                                        ? profile.productsServices.substring(0, 120) + (profile.productsServices.length > 120 ? '…' : '')
                                                        : 'Not defined'}
                                                </span>
                                            </div>
                                            <hr className="leads-context-divider" />
                                            <div className="leads-context-item">
                                                <span className="leads-context-label">Target Market</span>
                                                <span className={`leads-context-value ${!profile?.targetCustomers ? 'empty' : ''}`}>
                                                    {profile?.targetCustomers
                                                        ? profile.targetCustomers.substring(0, 120) + (profile.targetCustomers.length > 120 ? '…' : '')
                                                        : 'Not defined'}
                                                </span>
                                            </div>
                                            <hr className="leads-context-divider" />
                                            <div className="leads-context-item">
                                                <span className="leads-context-label">Markets</span>
                                                <span className={`leads-context-value ${!profile?.markets ? 'empty' : ''}`}>
                                                    {profile?.markets || 'Not defined'}
                                                </span>
                                            </div>
                                            <hr className="leads-context-divider" />
                                            <div className="leads-context-item">
                                                <span className="leads-context-label">Value Proposition</span>
                                                <span className={`leads-context-value ${!profile?.valueProposition ? 'empty' : ''}`}>
                                                    {profile?.valueProposition
                                                        ? profile.valueProposition.substring(0, 100) + (profile.valueProposition.length > 100 ? '…' : '')
                                                        : 'Not defined'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="leads-context-hint">
                                            <Lightbulb size={14} strokeWidth={2} /> Fill in the Company Profile to improve the quality of discovered leads.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {discovering && (
                        <div className="leads-loading-container">
                            <div className="leads-loading-spinner" />
                            <div className="leads-loading-text">Discovering leads…</div>
                            <div className="leads-loading-steps">
                                {LOADING_STEPS.map((step, i) => (
                                    <div
                                        key={i}
                                        className={`leads-loading-step ${i < loadingStep ? 'done' : ''} ${i === loadingStep ? 'active' : ''}`}
                                    >
                                        <div className="leads-loading-step-dot" />
                                        {step}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {!discovering && results.length > 0 && (
                        <>
                            <div className="leads-results-header">
                                <div className="leads-results-count">
                                    <span>{results.length}</span> leads found
                                </div>
                                <div className="leads-results-actions">
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setShowSaveDialog(true)}
                                    >
                                         <Save size={14} strokeWidth={2} /> Save List
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleExport(currentRunId || undefined)}
                                    >
                                         <Download size={14} strokeWidth={2} /> Export CSV
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => { setResults([]); setCurrentRunId(null); }}
                                    >
                                         <RefreshCw size={14} strokeWidth={2} /> New Search
                                    </button>
                                </div>
                            </div>

                            <div className="leads-card-grid">
                                {results.map(lead => (
                                    <div
                                        key={lead.id}
                                        className="lead-card"
                                        onClick={() => setSelectedLead(lead)}
                                    >
                                        <div className="lead-card-header">
                                            <h3 className="lead-card-name">{lead.companyName}</h3>
                                            <div className={`lead-card-score ${scoreClass(lead.relevanceScore)}`}>
                                                {lead.relevanceScore ?? '—'}%
                                            </div>
                                        </div>
                                        <div className="lead-card-meta">
                                            {lead.industry && (
                                                <span className="lead-card-meta-item"><Tag size={12} strokeWidth={2} /> {lead.industry}</span>
                                            )}
                                            {lead.location && (
                                                <span className="lead-card-meta-item"><MapPin size={12} strokeWidth={2} /> {lead.location}</span>
                                            )}
                                            {lead.website && (
                                                <span className="lead-card-meta-item">
                                                    <Globe size={12} strokeWidth={2} /> <a href={lead.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                                        {lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                                                    </a>
                                                </span>
                                            )}
                                        </div>
                                        {lead.whyFit && (
                                            <div className="lead-card-fit">
                                                <strong>Why it's relevant:</strong> {lead.whyFit}
                                            </div>
                                        )}
                                        {lead.likelyContactRoles && lead.likelyContactRoles.length > 0 && (
                                            <div className="lead-card-roles">
                                                {lead.likelyContactRoles.slice(0, 3).map((role, i) => (
                                                    <span key={i} className="lead-card-role-tag">{role}</span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="lead-card-actions" onClick={e => e.stopPropagation()}>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => setSelectedLead(lead)}
                                            >
                                                <Eye size={14} strokeWidth={2} /> Details
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Empty state (no search run yet) */}
                    {!discovering && results.length === 0 && currentRunId && (
                        <div className="leads-empty">
                             <div className="leads-empty-icon"><Search size={24} strokeWidth={2} /></div>
                            <h3>No strong leads found</h3>
                            <p>Try broadening the target market, changing the geography, or simplifying the search criteria.</p>
                            <button className="btn btn-primary" onClick={() => setCurrentRunId(null)}>
                                 <RefreshCw size={14} strokeWidth={2} /> Try Again
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ─── Lists Tab ─────────────────────────── */}
            {activeTab === 'lists' && (
                <>
                    {listsLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                            <div className="spinner" />
                        </div>
                    ) : lists.length === 0 ? (
                        <div className="leads-empty">
                             <div className="leads-empty-icon"><ClipboardList size={24} strokeWidth={2} /></div>
                            <h3>No saved lists</h3>
                            <p>After discovering leads, you can save the results to a list for future use.</p>
                            <button className="btn btn-primary" onClick={() => setActiveTab('discover')}>
                                🔍 Discover Leads
                            </button>
                        </div>
                    ) : (
                        <div className="leads-list-grid">
                            {lists.map(list => (
                                <div key={list.id} className="leads-list-card">
                                    <div className="leads-list-card-info">
                                        <div className="leads-list-card-name">{list.name}</div>
                                        <div className="leads-list-card-meta">
                                            <span>{list.itemCount} leads</span>
                                            <span>{new Date(list.createdAt).toLocaleDateString('en-US')}</span>
                                        </div>
                                    </div>
                                    <div className="leads-list-card-actions">
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleExport(undefined, list.id)}
                                        >
                                             <Download size={14} strokeWidth={2} /> Export
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleDeleteList(list.id, list.name)}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ─── History Tab ────────────────────────── */}
            {activeTab === 'history' && (
                <>
                    {historyLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                            <div className="spinner" />
                        </div>
                    ) : runs.length === 0 ? (
                        <div className="leads-empty">
                             <div className="leads-empty-icon"><Clock size={24} strokeWidth={2} /></div>
                            <h3>No search history</h3>
                            <p>Lead searches you run will appear here for future reference.</p>
                            <button className="btn btn-primary" onClick={() => setActiveTab('discover')}>
                                🔍 Discover Leads
                            </button>
                        </div>
                    ) : (
                        <div className="leads-history-grid">
                            {runs.map(run => (
                                <div key={run.id} className="leads-history-item">
                                    <div className="leads-history-info">
                                        <div className="leads-history-query">{run.title || run.query}</div>
                                        <div className="leads-history-meta">
                                            <span>{run.resultCount} leads</span>
                                            <span>{new Date(run.createdAt).toLocaleDateString('en-US')}</span>
                                        </div>
                                    </div>
                                    <span className={`leads-history-status ${run.status}`}>
                                        {run.status === 'completed' ? '✓ Completed' : run.status === 'running' ? 'Running' : 'Failed'}
                                    </span>
                                    <div className="leads-history-actions">
                                        {run.status === 'completed' && (
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => loadRunResults(run.id)}
                                            >
                                                <FolderOpen size={14} strokeWidth={2} /> View Results
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleDeleteRun(run.id)}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ─── Lead Detail Modal ─────────────────── */}
            {selectedLead && (
                <div className="lead-modal-overlay" onClick={() => setSelectedLead(null)}>
                    <div className="lead-modal" onClick={e => e.stopPropagation()}>
                        <div className="lead-modal-header">
                            <div>
                                <h2 className="lead-modal-title">{selectedLead.companyName}</h2>
                                <div className={`lead-card-score ${scoreClass(selectedLead.relevanceScore)}`} style={{ marginTop: 8, display: 'inline-flex' }}>
                                    Relevance: {selectedLead.relevanceScore ?? '—'}%
                                </div>
                            </div>
                            <button className="lead-modal-close" onClick={() => setSelectedLead(null)}>✕</button>
                        </div>

                        <div className="lead-modal-body">
                            {/* Meta grid */}
                            <div className="lead-modal-section">
                                <div className="lead-modal-meta-grid">
                                    {selectedLead.industry && (
                                        <div className="lead-modal-meta-item">
                                            <span className="lead-modal-meta-label">Industry</span>
                                            <span className="lead-modal-meta-value">{selectedLead.industry}</span>
                                        </div>
                                    )}
                                    {selectedLead.location && (
                                        <div className="lead-modal-meta-item">
                                            <span className="lead-modal-meta-label">Location</span>
                                            <span className="lead-modal-meta-value">{selectedLead.location}</span>
                                        </div>
                                    )}
                                    {selectedLead.website && (
                                        <div className="lead-modal-meta-item">
                                            <span className="lead-modal-meta-label">Website</span>
                                            <span className="lead-modal-meta-value">
                                                <a href={selectedLead.website} target="_blank" rel="noopener noreferrer">
                                                    {selectedLead.website.replace(/^https?:\/\/(www\.)?/, '')}
                                                </a>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Summary */}
                            {selectedLead.summary && (
                                <div className="lead-modal-section">
                                    <div className="lead-modal-section-label">Summary</div>
                                    <div className="lead-modal-section-content">{selectedLead.summary}</div>
                                </div>
                            )}

                            {/* Why it fits */}
                            {selectedLead.whyFit && (
                                <div className="lead-modal-section">
                                    <div className="lead-modal-section-label">Why It's Relevant</div>
                                    <div className="lead-modal-section-content">{selectedLead.whyFit}</div>
                                </div>
                            )}

                            {/* Suggested approach */}
                            {selectedLead.suggestedApproach && (
                                <div className="lead-modal-section">
                                    <div className="lead-modal-section-label">Suggested Approach</div>
                                    <div className="lead-modal-section-content">{selectedLead.suggestedApproach}</div>
                                </div>
                            )}

                            {/* Contact roles */}
                            {selectedLead.likelyContactRoles && selectedLead.likelyContactRoles.length > 0 && (
                                <div className="lead-modal-section">
                                    <div className="lead-modal-section-label">Target Roles</div>
                                    <div className="lead-card-roles">
                                        {selectedLead.likelyContactRoles.map((role, i) => (
                                            <span key={i} className="lead-card-role-tag">{role}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Source links */}
                            {selectedLead.sourceLinks && selectedLead.sourceLinks.length > 0 && (
                                <div className="lead-modal-section">
                                    <div className="lead-modal-section-label">Sources</div>
                                    <div className="lead-modal-sources">
                                        {selectedLead.sourceLinks.map((source, i) => (
                                            <a
                                                key={i}
                                                href={source.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="lead-modal-source-link"
                                            >
                                                <LinkIcon size={12} strokeWidth={2} /> {source.title || source.url}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="lead-modal-footer">
                            <button className="btn btn-ghost" onClick={() => setSelectedLead(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Save to List Dialog ────────────────── */}
            {showSaveDialog && (
                <div className="lead-modal-overlay" onClick={() => setShowSaveDialog(false)}>
                    <div className="leads-save-dialog" onClick={e => e.stopPropagation()}>
                         <h3><Save size={14} strokeWidth={2} /> Save Lead List</h3>
                        <div className="leads-form-group">
                            <label htmlFor="save-name">List Name *</label>
                            <input
                                id="save-name"
                                value={saveListName}
                                onChange={e => setSaveListName(e.target.value)}
                                placeholder="E.g.: Logistics Portugal - March 2026"
                            />
                        </div>
                        <div className="leads-form-group">
                            <label htmlFor="save-desc">Description</label>
                            <textarea
                                id="save-desc"
                                value={saveListDesc}
                                onChange={e => setSaveListDesc(e.target.value)}
                                placeholder="Optional description..."
                                rows={3}
                            />
                        </div>
                        <div className="leads-save-dialog-footer">
                            <button className="btn btn-ghost" onClick={() => setShowSaveDialog(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveToList}>
                                💾 Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
