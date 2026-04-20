'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { t, DEFAULT_LOCALE, type Locale } from '@/i18n';
import {
    Rocket, Building2, Brain, FileText, ClipboardCheck, PartyPopper,
    ArrowLeft, ArrowRight, Check, Clock, Upload, FolderOpen, X,
    Lightbulb, AlertTriangle, Loader2, CheckCircle, XCircle,
    MessageSquare, BookOpen, Bot, GraduationCap, Sparkles
} from 'lucide-react';

/* ─── Types ────────────────────────────────────────────── */

interface OnboardingState {
    currentStep: number;
    completedSteps: number[];
    stepDrafts: Record<string, Record<string, string>>;
}

interface UploadedFile {
    id: string;
    name: string;
    status: 'uploading' | 'done' | 'error';
}

interface CompanyProfile {
    companyName: string;
    description: string;
    industry: string;
    website: string;
    foundedYear: string;
    productsServices: string;
    mainOfferings: string;
    valueProposition: string;
    targetCustomers: string;
    targetIndustries: string;
    markets: string;
    departments: string;
    internalTools: string;
    keyProcesses: string;
    competitors: string;
    strategicGoals: string;
    brandTone: string;
}

const EMPTY_PROFILE: CompanyProfile = {
    companyName: '', description: '', industry: '', website: '', foundedYear: '',
    productsServices: '', mainOfferings: '', valueProposition: '',
    targetCustomers: '', targetIndustries: '', markets: '',
    departments: '', internalTools: '', keyProcesses: '',
    competitors: '', strategicGoals: '', brandTone: '',
};

/* ═══════════════════════════════════════════════════════ */

export default function SetupWizardPage() {
    const router = useRouter();
    const [lang, setLang] = useState<Locale>(DEFAULT_LOCALE);

    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1);
    const [completedSteps, setCompletedSteps] = useState<number[]>([]);

    // Step 2 & 3 — Company profile
    const [profile, setProfile] = useState<CompanyProfile>(EMPTY_PROFILE);
    const [savingProfile, setSavingProfile] = useState(false);

    // Step 4 — Documents
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [docCount, setDocCount] = useState(0);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Step 5 — Guide generation
    const [guideStatus, setGuideStatus] = useState<'idle' | 'generating' | 'ready' | 'failed'>('idle');

    // Step labels — resolved at render time
    const STEPS = [
        { num: 1, labelKey: 'setup.step1Label' },
        { num: 2, labelKey: 'setup.step2Label' },
        { num: 3, labelKey: 'setup.step3Label' },
        { num: 4, labelKey: 'setup.step4Label' },
        { num: 5, labelKey: 'setup.step5Label' },
        { num: 6, labelKey: 'setup.step6Label' },
    ];

    // ─── Load state ──────────────────────────────────

    useEffect(() => {
        loadOnboardingState();
        loadProfile();
        loadDocCount();
        // Fetch company language
        fetch('/api/user/language')
            .then(r => r.json())
            .then(data => { if (data.language) setLang(data.language as Locale); })
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    async function loadOnboardingState() {
        try {
            const res = await fetch('/api/onboarding/state');
            const data = await res.json();
            if (data.state) {
                setStep(data.state.currentStep ?? 1);
                setCompletedSteps(data.state.completedSteps ?? []);
            }
        } catch { /* start from step 1 */ }
        setLoading(false);
    }

    async function loadProfile() {
        try {
            const res = await fetch('/api/company/profile');
            const data = await res.json();
            if (data.profile) {
                setProfile({
                    companyName: data.profile.companyName ?? '',
                    description: data.profile.description ?? '',
                    industry: data.profile.industry ?? '',
                    website: data.profile.website ?? '',
                    foundedYear: data.profile.foundedYear ? String(data.profile.foundedYear) : '',
                    productsServices: data.profile.productsServices ?? '',
                    mainOfferings: data.profile.mainOfferings ?? '',
                    valueProposition: data.profile.valueProposition ?? '',
                    targetCustomers: data.profile.targetCustomers ?? '',
                    targetIndustries: data.profile.targetIndustries ?? '',
                    markets: data.profile.markets ?? '',
                    departments: data.profile.departments ?? '',
                    internalTools: data.profile.internalTools ?? '',
                    keyProcesses: data.profile.keyProcesses ?? '',
                    competitors: data.profile.competitors ?? '',
                    strategicGoals: data.profile.strategicGoals ?? '',
                    brandTone: data.profile.brandTone ?? '',
                });
            }
        } catch { /* ignore */ }
    }

    async function loadDocCount() {
        try {
            const res = await fetch('/api/documents?countOnly=true');
            const data = await res.json();
            setDocCount(data.count ?? data.documents?.length ?? 0);
        } catch { /* ignore */ }
    }

    // ─── Save state ──────────────────────────────────

    const saveState = useCallback(async (newStep: number, newCompleted: number[]) => {
        try {
            await fetch('/api/onboarding/state', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentStep: newStep,
                    completedSteps: newCompleted,
                }),
            });
        } catch { /* silent */ }
    }, []);

    // ─── Navigation ──────────────────────────────────

    async function goNext() {
        const newCompleted = completedSteps.includes(step)
            ? completedSteps
            : [...completedSteps, step];
        const nextStep = step + 1;

        setCompletedSteps(newCompleted);
        setStep(nextStep);
        await saveState(nextStep, newCompleted);
    }

    async function goBack() {
        const prevStep = step - 1;
        if (prevStep < 1) return;
        setStep(prevStep);
        await saveState(prevStep, completedSteps);
    }

    // ─── Step 2 & 3: Save profile ────────────────────

    async function saveProfile() {
        setSavingProfile(true);
        try {
            await fetch('/api/company/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...profile,
                    foundedYear: profile.foundedYear ? Number(profile.foundedYear) : null,
                }),
            });
        } catch { /* ignore */ }
        setSavingProfile(false);
    }

    function handleProfileChange(key: keyof CompanyProfile, value: string) {
        setProfile(prev => ({ ...prev, [key]: value }));
    }

    // ─── Step 4: Upload ──────────────────────────────

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const tempId = `temp-${Date.now()}-${i}`;

            setUploadedFiles(prev => [...prev, { id: tempId, name: file.name, status: 'uploading' }]);

            try {
                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch('/api/documents/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (res.ok) {
                    const data = await res.json();
                    setUploadedFiles(prev =>
                        prev.map(f => f.id === tempId ? { ...f, id: data.document?.id ?? tempId, status: 'done' } : f)
                    );
                    setDocCount(c => c + 1);
                } else {
                    setUploadedFiles(prev =>
                        prev.map(f => f.id === tempId ? { ...f, status: 'error' } : f)
                    );
                }
            } catch {
                setUploadedFiles(prev =>
                    prev.map(f => f.id === tempId ? { ...f, status: 'error' } : f)
                );
            }
        }
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
    }

    function removeFile(id: string) {
        setUploadedFiles(prev => prev.filter(f => f.id !== id));
    }

    // ─── Step 5: Guide generation ────────────────────

    async function generateGuide() {
        setGuideStatus('generating');
        try {
            const res = await fetch('/api/company/onboarding-guide/generate', {
                method: 'POST',
            });
            if (res.ok) {
                setGuideStatus('ready');
            } else {
                setGuideStatus('failed');
            }
        } catch {
            setGuideStatus('failed');
        }
    }

    // ─── Step 6: Complete ────────────────────────────

    async function completeOnboarding() {
        try {
            await fetch('/api/onboarding/complete', { method: 'POST' });
        } catch { /* ignore */ }
        router.replace('/dashboard');
    }

    // ─── Render ──────────────────────────────────────

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <>
            {/* Progress bar */}
            <div className="setup-progress">
                <div className="setup-progress-bar">
                    {STEPS.map((s, idx) => (
                        <div key={s.num} style={{ display: 'contents' }}>
                            {idx > 0 && (
                                <div className={`setup-progress-line ${completedSteps.includes(s.num - 1) ? 'completed' : ''}`} />
                            )}
                            <div className={`setup-progress-step ${step === s.num ? 'active' : ''} ${completedSteps.includes(s.num) ? 'completed' : ''}`}>
                                <div className="setup-progress-dot">
                                    {completedSteps.includes(s.num) ? <Check size={14} strokeWidth={3} /> : s.num}
                                </div>
                                <div className="setup-progress-label">{t(lang, s.labelKey)}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ─── Step 1: Welcome ─── */}
            {step === 1 && (
                <div className="setup-card">
                    <div className="setup-card-icon"><Rocket size={36} strokeWidth={1.5} /></div>
                    <h2>{t(lang, 'setup.welcomeTitle')}</h2>
                    <p className="setup-card-subtitle">{t(lang, 'setup.welcomeSubtitle')}</p>
                    <div className="setup-info-box">
                        <strong>{t(lang, 'setup.whatWillHappen')}</strong>
                        <ul>
                            <li>{t(lang, 'setup.welcomeStep1')}</li>
                            <li>{t(lang, 'setup.welcomeStep2')}</li>
                            <li>{t(lang, 'setup.welcomeStep3')}</li>
                            <li>{t(lang, 'setup.welcomeStep4')}</li>
                        </ul>
                        <div className="setup-time">
                            <Clock size={12} strokeWidth={2} /> {t(lang, 'setup.estimatedTime')}
                        </div>
                    </div>
                    <div className="setup-actions">
                        <div />
                        <button className="btn btn-primary" onClick={goNext}>
                            {t(lang, 'setup.startSetup')} <ArrowRight size={14} strokeWidth={2} />
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Step 2: Company Profile ─── */}
            {step === 2 && (
                <div className="setup-card">
                    <div className="setup-card-icon"><Building2 size={36} strokeWidth={1.5} /></div>
                    <h2>{t(lang, 'setup.companyProfileTitle')}</h2>
                    <p className="setup-card-subtitle">{t(lang, 'setup.companyProfileSubtitle')}</p>

                    <div className="setup-form-section">
                        <div className="setup-form-grid">
                            <div className="setup-field">
                                <label>{t(lang, 'setup.companyName')} <span className="required">*</span></label>
                                <input value={profile.companyName} onChange={e => handleProfileChange('companyName', e.target.value)} placeholder="Ex: Nousio" />
                            </div>
                            <div className="setup-field">
                                <label>{t(lang, 'setup.industry')}</label>
                                <input value={profile.industry} onChange={e => handleProfileChange('industry', e.target.value)} />
                            </div>
                            <div className="setup-field">
                                <label>{t(lang, 'setup.website')}</label>
                                <input value={profile.website} onChange={e => handleProfileChange('website', e.target.value)} placeholder="https://..." type="url" />
                            </div>
                            <div className="setup-field">
                                <label>{t(lang, 'setup.foundedYear')}</label>
                                <input value={profile.foundedYear} onChange={e => handleProfileChange('foundedYear', e.target.value)} type="number" min={1800} max={new Date().getFullYear()} />
                            </div>
                            <div className="setup-field full-width">
                                <label>{t(lang, 'setup.companyDescription')} <span className="required">*</span></label>
                                <textarea value={profile.description} onChange={e => handleProfileChange('description', e.target.value)} placeholder={t(lang, 'setup.companyDescriptionPlaceholder')} rows={3} />
                            </div>
                            <div className="setup-field full-width">
                                <label>{t(lang, 'setup.productsServices')}</label>
                                <textarea value={profile.productsServices} onChange={e => handleProfileChange('productsServices', e.target.value)} placeholder={t(lang, 'setup.productsServicesPlaceholder')} rows={3} />
                            </div>
                            <div className="setup-field full-width">
                                <label>{t(lang, 'setup.valueProposition')}</label>
                                <textarea value={profile.valueProposition} onChange={e => handleProfileChange('valueProposition', e.target.value)} placeholder={t(lang, 'setup.valuePropositionPlaceholder')} rows={2} />
                            </div>
                        </div>
                    </div>

                    <div className="setup-actions">
                        <button className="btn btn-secondary" onClick={goBack}><ArrowLeft size={14} strokeWidth={2} /> {t(lang, 'common.back')}</button>
                        <button className="btn btn-primary" disabled={savingProfile} onClick={async () => { await saveProfile(); goNext(); }}>
                            {savingProfile ? t(lang, 'common.saving') : <>{t(lang, 'setup.saveAndContinue')} <ArrowRight size={14} strokeWidth={2} /></>}
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Step 3: Business Context ─── */}
            {step === 3 && (
                <div className="setup-card">
                    <div className="setup-card-icon"><Brain size={36} strokeWidth={1.5} /></div>
                    <h2>{t(lang, 'setup.businessContextTitle')}</h2>
                    <p className="setup-card-subtitle">{t(lang, 'setup.businessContextSubtitle')}</p>

                    <div className="setup-form-section">
                        <div className="setup-form-grid">
                            <div className="setup-field full-width">
                                <label>{t(lang, 'setup.targetCustomers')}</label>
                                <textarea value={profile.targetCustomers} onChange={e => handleProfileChange('targetCustomers', e.target.value)} placeholder={t(lang, 'setup.targetCustomersPlaceholder')} rows={3} />
                            </div>
                            <div className="setup-field">
                                <label>{t(lang, 'setup.targetIndustries')}</label>
                                <textarea value={profile.targetIndustries} onChange={e => handleProfileChange('targetIndustries', e.target.value)} placeholder={t(lang, 'setup.targetIndustriesPlaceholder')} rows={2} />
                            </div>
                            <div className="setup-field">
                                <label>{t(lang, 'setup.markets')}</label>
                                <textarea value={profile.markets} onChange={e => handleProfileChange('markets', e.target.value)} placeholder={t(lang, 'setup.marketsPlaceholder')} rows={2} />
                            </div>
                            <div className="setup-field full-width">
                                <label>{t(lang, 'setup.keyProcesses')}</label>
                                <textarea value={profile.keyProcesses} onChange={e => handleProfileChange('keyProcesses', e.target.value)} placeholder={t(lang, 'setup.keyProcessesPlaceholder')} rows={3} />
                            </div>
                            <div className="setup-field">
                                <label>{t(lang, 'setup.departments')}</label>
                                <textarea value={profile.departments} onChange={e => handleProfileChange('departments', e.target.value)} placeholder={t(lang, 'setup.departmentsPlaceholder')} rows={2} />
                            </div>
                            <div className="setup-field">
                                <label>{t(lang, 'setup.internalTools')}</label>
                                <textarea value={profile.internalTools} onChange={e => handleProfileChange('internalTools', e.target.value)} placeholder={t(lang, 'setup.internalToolsPlaceholder')} rows={2} />
                            </div>
                            <div className="setup-field">
                                <label>{t(lang, 'setup.competitors')}</label>
                                <textarea value={profile.competitors} onChange={e => handleProfileChange('competitors', e.target.value)} placeholder={t(lang, 'setup.competitorsPlaceholder')} rows={2} />
                            </div>
                            <div className="setup-field">
                                <label>{t(lang, 'setup.strategicGoals')}</label>
                                <textarea value={profile.strategicGoals} onChange={e => handleProfileChange('strategicGoals', e.target.value)} placeholder={t(lang, 'setup.strategicGoalsPlaceholder')} rows={2} />
                            </div>
                            <div className="setup-field full-width">
                                <label>{t(lang, 'setup.brandTone')}</label>
                                <input value={profile.brandTone} onChange={e => handleProfileChange('brandTone', e.target.value)} placeholder={t(lang, 'setup.brandTonePlaceholder')} />
                            </div>
                        </div>
                    </div>

                    <div className="setup-actions">
                        <button className="btn btn-secondary" onClick={goBack}><ArrowLeft size={14} strokeWidth={2} /> {t(lang, 'common.back')}</button>
                        <button className="btn btn-primary" disabled={savingProfile} onClick={async () => { await saveProfile(); goNext(); }}>
                            {savingProfile ? t(lang, 'common.saving') : <>{t(lang, 'setup.saveAndContinue')} <ArrowRight size={14} strokeWidth={2} /></>}
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Step 4: Upload Documents ─── */}
            {step === 4 && (
                <div className="setup-card">
                    <div className="setup-card-icon"><FileText size={36} strokeWidth={1.5} /></div>
                    <h2>{t(lang, 'setup.uploadTitle')}</h2>
                    <p className="setup-card-subtitle">{t(lang, 'setup.uploadSubtitle')}</p>

                    <div className="setup-suggestion">
                        <Lightbulb size={16} strokeWidth={2} className="suggestion-icon" />
                        <span><strong>{t(lang, 'setup.uploadSuggestions')}</strong></span>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => handleFiles(e.target.files)}
                        accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xls,.pptx,.ppt,.csv,.png,.jpg,.jpeg"
                    />

                    <div
                        className={`setup-upload-zone ${dragging ? 'dragging' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                    >
                        <div className="setup-upload-icon"><Upload size={28} strokeWidth={1.5} /></div>
                        <h4>{t(lang, 'setup.dragOrClick')}</h4>
                        <p>{t(lang, 'setup.supportedFormats')}</p>
                    </div>

                    {uploadedFiles.length > 0 && (
                        <div className="setup-file-list">
                            {uploadedFiles.map(f => (
                                <div key={f.id} className="setup-file-item">
                                    <FileText size={14} strokeWidth={2} className="file-icon" />
                                    <span className="file-name">{f.name}</span>
                                    <span className={`file-status ${f.status}`}>
                                        {f.status === 'uploading' && <><Loader2 size={12} strokeWidth={2} className="animate-spin" /> {t(lang, 'setup.uploading')}</>}
                                        {f.status === 'done' && <><CheckCircle size={12} strokeWidth={2} /> {t(lang, 'setup.complete')}</>}
                                        {f.status === 'error' && <><XCircle size={12} strokeWidth={2} /> {t(lang, 'setup.uploadError')}</>}
                                    </span>
                                    {f.status !== 'uploading' && (
                                        <button className="setup-file-remove" onClick={() => removeFile(f.id)} title={t(lang, 'common.delete')}>
                                            <X size={14} strokeWidth={2} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {uploadedFiles.length === 0 && (
                        <div className="setup-warning">
                            <AlertTriangle size={16} strokeWidth={2} className="warning-icon" />
                            <span>{t(lang, 'setup.uploadWarning')}</span>
                        </div>
                    )}

                    <div className="setup-actions">
                        <button className="btn btn-secondary" onClick={goBack}><ArrowLeft size={14} strokeWidth={2} /> {t(lang, 'common.back')}</button>
                        <button className="btn btn-primary" onClick={goNext}>
                            {uploadedFiles.filter(f => f.status === 'done').length > 0
                                ? <>{t(lang, 'setup.continueBtn')} <ArrowRight size={14} strokeWidth={2} /></>
                                : t(lang, 'setup.skipAndContinue')}
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Step 5: Review & Guide ─── */}
            {step === 5 && (
                <div className="setup-card">
                    <div className="setup-card-icon"><ClipboardCheck size={36} strokeWidth={1.5} /></div>
                    <h2>{t(lang, 'setup.reviewTitle')}</h2>
                    <p className="setup-card-subtitle">{t(lang, 'setup.reviewSubtitle')}</p>

                    <div className="setup-review-section">
                        <div className="setup-review-title">{t(lang, 'setup.companyProfile')}</div>
                        <div className="setup-review-content">
                            <div className="setup-review-stat">
                                <span className="label">{t(lang, 'common.name')}</span>
                                <span className="value">{profile.companyName || '—'}</span>
                            </div>
                            <div className="setup-review-stat">
                                <span className="label">{t(lang, 'setup.industry')}</span>
                                <span className="value">{profile.industry || '—'}</span>
                            </div>
                            <div className="setup-review-stat">
                                <span className="label">{t(lang, 'setup.website')}</span>
                                <span className="value">{profile.website || '—'}</span>
                            </div>
                            <div className="setup-review-stat">
                                <span className="label">{t(lang, 'common.description')}</span>
                                <span className="value">{profile.description ? `${profile.description.substring(0, 80)}...` : '—'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="setup-review-section">
                        <div className="setup-review-title">{t(lang, 'nav.documents')}</div>
                        <div className="setup-review-content">
                            <div className="setup-review-stat">
                                <span className="label">{t(lang, 'setup.documentsUploaded')}</span>
                                <span className="value">{docCount + uploadedFiles.filter(f => f.status === 'done').length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="setup-review-section">
                        <div className="setup-review-title">{t(lang, 'setup.generateGuide')}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                            {t(lang, 'setup.guideDescription')}
                        </div>

                        {guideStatus === 'idle' && (
                            <button className="btn btn-primary" onClick={generateGuide} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <Sparkles size={14} strokeWidth={2} /> {t(lang, 'setup.generateWithAi')}
                            </button>
                        )}

                        {guideStatus === 'generating' && (
                            <div className="setup-guide-status generating">
                                <Loader2 size={16} strokeWidth={2} className="animate-spin" /> {t(lang, 'setup.generating')}
                            </div>
                        )}

                        {guideStatus === 'ready' && (
                            <div className="setup-guide-status ready">
                                <CheckCircle size={16} strokeWidth={2} /> {t(lang, 'setup.guideReady')}
                            </div>
                        )}

                        {guideStatus === 'failed' && (
                            <div className="setup-guide-status failed">
                                <XCircle size={16} strokeWidth={2} /> {t(lang, 'setup.guideFailed')}
                                <button className="btn btn-secondary" onClick={generateGuide} style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 12px' }}>
                                    {t(lang, 'common.retry')}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="setup-actions">
                        <button className="btn btn-secondary" onClick={goBack}><ArrowLeft size={14} strokeWidth={2} /> {t(lang, 'common.back')}</button>
                        <button className="btn btn-primary" onClick={goNext}>
                            {t(lang, 'setup.completeSetup')} <ArrowRight size={14} strokeWidth={2} />
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Step 6: Complete ─── */}
            {step === 6 && (
                <div className="setup-card">
                    <div className="setup-complete-icon"><PartyPopper size={48} strokeWidth={1.5} /></div>
                    <h2>{t(lang, 'setup.completeTitle')}</h2>
                    <p className="setup-card-subtitle">{t(lang, 'setup.completeSubtitle')}</p>

                    <div className="setup-shortcuts">
                        <a className="setup-shortcut" onClick={completeOnboarding}>
                            <span className="setup-shortcut-icon"><Bot size={24} strokeWidth={1.5} /></span>
                            <span className="setup-shortcut-label">{t(lang, 'setup.openChat')}</span>
                        </a>
                        <a className="setup-shortcut" href="/company/profile" onClick={async () => { await fetch('/api/onboarding/complete', { method: 'POST' }); }}>
                            <span className="setup-shortcut-icon"><Building2 size={24} strokeWidth={1.5} /></span>
                            <span className="setup-shortcut-label">{t(lang, 'setup.companyProfileLink')}</span>
                        </a>
                        <a className="setup-shortcut" href="/documents" onClick={async () => { await fetch('/api/onboarding/complete', { method: 'POST' }); }}>
                            <span className="setup-shortcut-icon"><FileText size={24} strokeWidth={1.5} /></span>
                            <span className="setup-shortcut-label">{t(lang, 'setup.documentsLink')}</span>
                        </a>
                        <a className="setup-shortcut" href="/onboarding-assistant" onClick={async () => { await fetch('/api/onboarding/complete', { method: 'POST' }); }}>
                            <span className="setup-shortcut-icon"><GraduationCap size={24} strokeWidth={1.5} /></span>
                            <span className="setup-shortcut-label">{t(lang, 'setup.onboardingAssistantLink')}</span>
                        </a>
                    </div>

                    <div className="setup-prompts">
                        <h4>{t(lang, 'setup.tryAsking')}</h4>
                        <a className="setup-prompt-item" onClick={completeOnboarding}>
                            <MessageSquare size={14} strokeWidth={2} className="prompt-icon" /> {t(lang, 'setup.prompt1')}
                        </a>
                        <a className="setup-prompt-item" onClick={completeOnboarding}>
                            <MessageSquare size={14} strokeWidth={2} className="prompt-icon" /> {t(lang, 'setup.prompt2')}
                        </a>
                        <a className="setup-prompt-item" onClick={completeOnboarding}>
                            <MessageSquare size={14} strokeWidth={2} className="prompt-icon" /> {t(lang, 'setup.prompt3')}
                        </a>
                        <a className="setup-prompt-item" onClick={completeOnboarding}>
                            <MessageSquare size={14} strokeWidth={2} className="prompt-icon" /> {t(lang, 'setup.prompt4')}
                        </a>
                    </div>

                    <div className="setup-actions" style={{ justifyContent: 'center' }}>
                        <button className="btn btn-primary" onClick={completeOnboarding} style={{ minWidth: 200 }}>
                            {t(lang, 'setup.startUsing')} <ArrowRight size={14} strokeWidth={2} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
