'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useT } from '@/i18n/context';
import { RefreshCw, Settings, Trash2, ExternalLink, X, FolderOpen, Check, Key } from 'lucide-react';
import './integrations.css';

/* ─── Constants ────────────────────────────────────────── */

// Providers that use a pasted token instead of OAuth redirect
const TOKEN_PROVIDERS = ['NOTION'];

/* ─── Types ─────────────────────────────────────────── */

interface Integration {
    id: string;
    provider: string;
    label: string;
    isActive: boolean;
    syncFrequency: string;
    lastSyncedAt: string | null;
    lastSyncStatus: string | null;
    actionCount: number;
    config: Record<string, unknown>;
    errorLog: string | null;
}

interface ExternalFolder {
    id: string;
    name: string;
    children?: ExternalFolder[];
}

/* ─── Provider Definitions ──────────────────────────── */

const PROVIDERS = [
    {
        key: 'GOOGLE_DRIVE',
        name: 'Google Drive',
        description: 'Sync documents from your Google Drive folders',
        icon: '/logos/google-drive.svg',
        available: true,
    },
    {
        key: 'NOTION',
        name: 'Notion',
        description: 'Import pages and databases from Notion',
        icon: '/logos/notion.svg',
        available: true,
    },
    {
        key: 'SHAREPOINT',
        name: 'SharePoint',
        description: 'Connect to Microsoft SharePoint libraries',
        icon: null,
        available: false,
    },
];

/* ─── Component ─────────────────────────────────────── */

export default function IntegrationsPage() {
    const { t } = useT();
    const searchParams = useSearchParams();

    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Settings modal state
    const [settingsModal, setSettingsModal] = useState<Integration | null>(null);
    const [folders, setFolders] = useState<ExternalFolder[]>([]);
    const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
    const [syncFrequency, setSyncFrequency] = useState('6h');
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    // Token paste modal state (for Notion-style integrations)
    const [tokenModal, setTokenModal] = useState<string | null>(null); // provider key
    const [tokenValue, setTokenValue] = useState('');
    const [connectingToken, setConnectingToken] = useState(false);

    // ── Toast helper ─────────────────────────────────
    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ── Load integrations ─────────────────────────────
    const loadIntegrations = useCallback(async () => {
        try {
            const res = await fetch('/api/integrations');
            const data = await res.json();
            setIntegrations(data.integrations || []);
        } catch {
            showToast('Failed to load integrations', 'error');
        }
        setLoading(false);
    }, [showToast]);

    useEffect(() => {
        loadIntegrations();
        // Check for OAuth callback success
        const connected = searchParams.get('connected');
        const error = searchParams.get('error');
        if (connected) {
            showToast(`${connected.replace('_', ' ')} connected successfully!`, 'success');
        }
        if (error) {
            showToast(`Connection failed: ${error}`, 'error');
        }
    }, [loadIntegrations, searchParams, showToast]);

    // ── Auto-poll when syncing ────────────────────────
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const hasSyncing = integrations.some(i => i.lastSyncStatus === 'SYNCING');
        if (hasSyncing && !pollRef.current) {
            pollRef.current = setInterval(() => {
                loadIntegrations();
            }, 5000);
        } else if (!hasSyncing && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [integrations, loadIntegrations]);

    // ── Connect provider ──────────────────────────────
    async function handleConnect(provider: string) {
        // Token-based providers show a modal for pasting the token
        if (TOKEN_PROVIDERS.includes(provider)) {
            setTokenModal(provider);
            setTokenValue('');
            return;
        }

        // OAuth-based providers redirect to the auth URL
        setConnecting(provider);
        try {
            const res = await fetch('/api/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider }),
            });

            if (res.status === 409) {
                showToast('Integration already exists', 'error');
                setConnecting(null);
                return;
            }

            const data = await res.json();
            if (data.authUrl) {
                window.location.href = data.authUrl;
            } else {
                showToast('Failed to start connection', 'error');
                setConnecting(null);
            }
        } catch {
            showToast('Connection failed', 'error');
            setConnecting(null);
        }
    }

    // ── Connect with token (Notion) ───────────────────
    async function handleConnectWithToken() {
        if (!tokenModal || !tokenValue.trim()) return;
        setConnectingToken(true);

        try {
            const res = await fetch('/api/integrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: tokenModal, token: tokenValue.trim() }),
            });

            if (res.status === 409) {
                showToast('Integration already exists', 'error');
            } else if (res.ok) {
                showToast(`${tokenModal.replace('_', ' ')} connected successfully!`, 'success');
                loadIntegrations();
            } else {
                const data = await res.json();
                showToast(data.error || 'Connection failed', 'error');
            }
        } catch {
            showToast('Connection failed', 'error');
        }

        setConnectingToken(false);
        setTokenModal(null);
        setTokenValue('');
    }

    // ── Sync integration ──────────────────────────────
    async function handleSync(integrationId: string) {
        setSyncing(integrationId);
        try {
            const res = await fetch(`/api/integrations/${integrationId}/sync`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message || 'Sync started in background', 'success');
                // Reload to pick up SYNCING status → triggers polling
                loadIntegrations();
            } else {
                showToast(data.error || 'Sync failed', 'error');
            }
        } catch {
            showToast('Sync failed', 'error');
        }
        setSyncing(null);
    }

    // ── Disconnect integration ────────────────────────
    async function handleDisconnect(integrationId: string) {
        if (!confirm('Are you sure you want to disconnect this integration? All synced documents and embeddings will be removed.')) return;

        try {
            await fetch(`/api/integrations/${integrationId}`, { method: 'DELETE' });
            showToast('Integration disconnected', 'success');
            loadIntegrations();
        } catch {
            showToast('Failed to disconnect', 'error');
        }
    }

    // ── Open settings modal ──────────────────────────
    async function handleOpenSettings(integration: Integration) {
        setSettingsModal(integration);
        setSelectedFolders((integration.config as { selectedFolders?: string[] })?.selectedFolders || []);
        setSyncFrequency(integration.syncFrequency || '6h');
        setLoadingFolders(true);

        try {
            const res = await fetch(`/api/integrations/${integration.id}/folders`);
            const data = await res.json();
            setFolders(data.folders || []);
        } catch {
            showToast('Failed to load folders', 'error');
        }
        setLoadingFolders(false);
    }

    // ── Save settings ────────────────────────────────
    async function handleSaveSettings() {
        if (!settingsModal) return;
        setSavingSettings(true);

        try {
            await fetch(`/api/integrations/${settingsModal.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config: { ...settingsModal.config, selectedFolders },
                    syncFrequency,
                }),
            });
            showToast('Settings saved', 'success');
            setSettingsModal(null);
            loadIntegrations();
        } catch {
            showToast('Failed to save settings', 'error');
        }
        setSavingSettings(false);
    }

    // ── Toggle folder selection ──────────────────────
    function toggleFolder(folderId: string) {
        setSelectedFolders(prev =>
            prev.includes(folderId)
                ? prev.filter(id => id !== folderId)
                : [...prev, folderId]
        );
    }

    // ── Helpers ──────────────────────────────────────
    function getIntegrationForProvider(provider: string): Integration | undefined {
        return integrations.find(i => i.provider === provider);
    }

    function formatSyncTime(dateStr: string | null): string {
        if (!dateStr) return 'Never';
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    // ── Loading state ────────────────────────────────
    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <>
            {/* ── Page Header ── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <h1>{t('integrations.title') !== 'integrations.title' ? t('integrations.title') : 'Integrations'}</h1>
                </div>
            </div>

            <div className="integrations-page">
                <p style={{ color: '#475569', fontSize: 14, marginBottom: 8 }}>
                    Connect your document management platforms to automatically sync and index your company knowledge.
                </p>

                {/* ── Provider Cards Grid ── */}
                <div className="integrations-grid">
                    {PROVIDERS.map(provider => {
                        const integration = getIntegrationForProvider(provider.key);
                        const isConnected = integration?.isActive;
                        const isSyncing = syncing === integration?.id;
                        const isConnecting = connecting === provider.key;

                        return (
                            <div
                                key={provider.key}
                                className={`integration-card ${!provider.available ? 'disabled' : ''}`}
                            >
                                {/* Header */}
                                <div className="integration-card-header">
                                    <div className="integration-card-icon">
                                        {provider.icon ? (
                                            <img src={provider.icon} alt={provider.name} />
                                        ) : (
                                            <ExternalLink size={20} color="#94a3b8" />
                                        )}
                                    </div>
                                    <div className="integration-card-info">
                                        <h3>{provider.name}</h3>
                                        <p>{provider.description}</p>
                                    </div>
                                </div>

                                {/* Status */}
                                <div>
                                    {!provider.available ? (
                                        <span className="integration-status coming-soon">
                                            <span className="integration-status-dot" />
                                            Coming Soon
                                        </span>
                                    ) : isConnected ? (
                                        <span className={`integration-status ${
                                            integration?.lastSyncStatus === 'FAILED' ? 'error' :
                                            integration?.lastSyncStatus === 'SYNCING' ? 'connected' :
                                            'connected'
                                        }`}>
                                            <span className="integration-status-dot" />
                                            {integration?.lastSyncStatus === 'FAILED' ? 'Error' :
                                             integration?.lastSyncStatus === 'SYNCING' ? 'Syncing…' :
                                             'Connected'}
                                        </span>
                                    ) : (
                                        <span className="integration-status not-connected">
                                            <span className="integration-status-dot" />
                                            Not Connected
                                        </span>
                                    )}
                                </div>

                                {/* Stats (only when connected) */}
                                {isConnected && integration && (
                                    <div className="integration-stats">
                                        <span>
                                            <strong>{integration.actionCount}</strong> files indexed
                                        </span>
                                        {integration.lastSyncedAt && (
                                            <span>
                                                Last sync: <strong>{formatSyncTime(integration.lastSyncedAt)}</strong>
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Error log */}
                                {integration?.errorLog && (
                                    <p style={{ fontSize: 11, color: '#dc2626', margin: 0 }}>
                                        {integration.errorLog}
                                    </p>
                                )}

                                {/* Actions */}
                                <div className="integration-actions">
                                    {!provider.available ? null : isConnected && integration ? (
                                        <>
                                            <button
                                                className="btn btn-sync"
                                                onClick={() => handleSync(integration.id)}
                                                disabled={isSyncing || integration.lastSyncStatus === 'SYNCING'}
                                            >
                                                <RefreshCw size={12} style={{ marginRight: 4 }} className={(isSyncing || integration.lastSyncStatus === 'SYNCING') ? 'spinning' : ''} />
                                                {(isSyncing || integration.lastSyncStatus === 'SYNCING') ? 'Syncing...' : 'Sync Now'}
                                            </button>

                                            <button
                                                className="btn btn-settings"
                                                onClick={() => handleOpenSettings(integration)}
                                            >
                                                <Settings size={12} style={{ marginRight: 4 }} />
                                                Settings
                                            </button>
                                            <button
                                                className="btn btn-danger"
                                                onClick={() => handleDisconnect(integration.id)}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="btn btn-connect"
                                            onClick={() => handleConnect(provider.key)}
                                            disabled={isConnecting}
                                        >
                                            {isConnecting ? 'Connecting...' : 'Connect'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Settings Modal ── */}
            {settingsModal && (
                <div className="integration-modal-overlay" onClick={() => setSettingsModal(null)}>
                    <div className="integration-modal" onClick={e => e.stopPropagation()}>
                        <div className="integration-modal-header">
                            <h2>
                                <Settings size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                                {settingsModal.label || settingsModal.provider} Settings
                            </h2>
                            <button className="integration-modal-close" onClick={() => setSettingsModal(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="integration-modal-body">
                            {/* Folder Selection */}
                            <div className="integration-config-field">
                                <label>
                                    <FolderOpen size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                    {settingsModal.provider === 'NOTION' ? 'Select Pages to Sync' : 'Select Folders to Sync'}
                                </label>
                                {loadingFolders ? (
                                    <div style={{ padding: 20, textAlign: 'center' }}>
                                        <div className="spinner" />
                                    </div>
                                ) : folders.length === 0 ? (
                                    <p style={{ color: '#64748b', fontSize: 13 }}>
                                    No items found. Make sure the connected account has accessible content.
                                    </p>
                                ) : (
                                    <div className="folder-tree">
                                        {folders.map(folder => (
                                            <div key={folder.id}>
                                                <div
                                                    className={`folder-item ${selectedFolders.includes(folder.id) ? 'selected' : ''}`}
                                                    onClick={() => toggleFolder(folder.id)}
                                                >
                                                    <div className={`folder-item-checkbox ${selectedFolders.includes(folder.id) ? 'checked' : ''}`} />
                                                    <FolderOpen size={14} />
                                                    <span>{folder.name}</span>
                                                </div>
                                                {folder.children && folder.children.length > 0 && (
                                                    <div className="folder-children">
                                                        {folder.children.map(child => (
                                                            <div
                                                                key={child.id}
                                                                className={`folder-item ${selectedFolders.includes(child.id) ? 'selected' : ''}`}
                                                                onClick={() => toggleFolder(child.id)}
                                                            >
                                                                <div className={`folder-item-checkbox ${selectedFolders.includes(child.id) ? 'checked' : ''}`} />
                                                                <FolderOpen size={12} />
                                                                <span>{child.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {selectedFolders.length > 0 && (
                                    <p style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, margin: 0 }}>
                                        <Check size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                        {selectedFolders.length} folder{selectedFolders.length !== 1 ? 's' : ''} selected
                                    </p>
                                )}
                            </div>

                            {/* Sync Frequency */}
                            <div className="integration-config-field">
                                <label>Sync Frequency</label>
                                <select value={syncFrequency} onChange={e => setSyncFrequency(e.target.value)}>
                                    <option value="1h">Every hour</option>
                                    <option value="6h">Every 6 hours</option>
                                    <option value="12h">Every 12 hours</option>
                                    <option value="24h">Every 24 hours</option>
                                    <option value="manual">Manual only</option>
                                </select>
                            </div>
                        </div>

                        <div className="integration-modal-footer">
                            <button
                                className="btn btn-sync"
                                style={{ border: '2px solid #0f172a' }}
                                onClick={() => setSettingsModal(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-connect"
                                onClick={handleSaveSettings}
                                disabled={savingSettings}
                            >
                                {savingSettings ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toast ── */}
            {toast && (
                <div className={`integration-toast ${toast.type}`}>
                    {toast.message}
                </div>
            )}

            {/* ── Token Paste Modal (Notion) ── */}
            {tokenModal && (
                <div className="integration-modal-overlay" onClick={() => setTokenModal(null)}>
                    <div className="integration-modal" onClick={e => e.stopPropagation()}>
                        <div className="integration-modal-header">
                            <h2>
                                <Key size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                                Connect {tokenModal.replace('_', ' ')}
                            </h2>
                            <button className="integration-modal-close" onClick={() => setTokenModal(null)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="integration-modal-body">
                            <div className="integration-config-field">
                                <label>Internal Integration Token</label>
                                <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px 0' }}>
                                    1. Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>notion.so/my-integrations</a> and create an <strong>Internal Integration</strong><br />
                                    2. Give it <strong>Read content</strong> capability<br />
                                    3. Copy the <strong>Internal Integration Secret</strong> and paste it below<br />
                                    4. In Notion, open the pages you want to sync and click <strong>&quot;…&quot; → Connect to → your integration</strong>
                                </p>
                                <input
                                    type="password"
                                    placeholder="ntn_xxxxxxxxxxxxxxxxxxxx"
                                    value={tokenValue}
                                    onChange={e => setTokenValue(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: '2px solid #0f172a',
                                        fontSize: 14,
                                        fontFamily: 'monospace',
                                        boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        </div>

                        <div className="integration-modal-footer">
                            <button
                                className="btn btn-sync"
                                style={{ border: '2px solid #0f172a' }}
                                onClick={() => setTokenModal(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-connect"
                                onClick={handleConnectWithToken}
                                disabled={connectingToken || !tokenValue.trim()}
                            >
                                {connectingToken ? 'Connecting...' : 'Connect'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
