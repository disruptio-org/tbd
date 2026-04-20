'use client';

import { useState, useEffect, useRef } from 'react';
import { FolderOpen, ChevronDown, Check, Settings } from 'lucide-react';
import './WorkspaceSelector.css';

export interface ProjectWorkspace {
    id: string;
    name: string;
    description: string | null;
    contextText: string | null;
}

interface WorkspaceSelectorProps {
    onSelect: (project: ProjectWorkspace | null) => void;
    selectedId?: string | null;
}

export default function WorkspaceSelector({ onSelect, selectedId }: WorkspaceSelectorProps) {
    const [projects, setProjects] = useState<ProjectWorkspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadProjects();

        // Close dropdown when clicking outside
        function handleClickOutside(event: MouseEvent) {
            if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function loadProjects() {
        try {
            setLoading(true);
            const res = await fetch('/api/projects');
            const data = await res.json();
            if (data.projects) {
                setProjects(data.projects);
            }
        } catch (error) {
            console.error('Failed to load projects workspaces:', error);
        } finally {
            setLoading(false);
        }
    }

    const selectedProject = projects.find(p => p.id === selectedId) || null;

    if (loading) {
        return (
            <div className="workspace-selector loading">
                <div className="workspace-selector-btn">
                    <span className="ws-spinner" /> Loading Workspace...
                </div>
            </div>
        );
    }

    if (projects.length === 0) {
        // If the user has no projects, we don't need to show the selector, 
        // or we just show them "Company Context". Returning null simplifies the UI.
        return null;
    }

    return (
        <div className="workspace-selector" ref={selectorRef}>
            <button 
                className={`workspace-selector-btn ${isOpen ? 'active' : ''} ${selectedProject ? 'has-selection' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="ws-icon"><FolderOpen size={16} strokeWidth={2} /></div>
                <div className="ws-text">
                    <span className="ws-label">Workspace:</span>
                    <span className="ws-value">{selectedProject ? selectedProject.name : 'Select Workspace'}</span>
                </div>
                <div className="ws-chevron"><ChevronDown size={14} strokeWidth={2} /></div>
            </button>

            {isOpen && (
                <div className="workspace-dropdown">
                    <div className="ws-dropdown-header">Select Context</div>
                    <div className="ws-dropdown-list">
                        {projects.map(project => (
                            <button 
                                key={project.id}
                                className={`ws-option ${selectedProject?.id === project.id ? 'selected' : ''}`}
                                onClick={() => { onSelect(project); setIsOpen(false); }}
                            >
                                <span className="ws-icon"><FolderOpen size={16} strokeWidth={2} /></span>
                                <div className="ws-details">
                                    <div className="ws-name">{project.name}</div>
                                </div>
                                {selectedProject?.id === project.id && <span className="ws-check"><Check size={14} strokeWidth={2} /></span>}
                            </button>
                        ))}
                    </div>
                    <div className="ws-dropdown-footer">
                        <a href="/projects" className="ws-manage-link">Manage Workspaces <Settings size={14} strokeWidth={2} /></a>
                    </div>
                </div>
            )}
        </div>
    );
}
