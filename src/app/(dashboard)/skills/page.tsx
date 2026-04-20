'use client';

import { useState, useRef } from 'react';
import { Zap, Upload, Plus } from 'lucide-react';
import SkillsManagerPanel from '../settings/ai-brain/SkillsManagerPanel';
import '../settings/ai-brain/ai-brain.css';

export default function SkillsPage() {
    return (
        <div className="skills-standalone-page">
            {/* ── Standard Page Header ────────────── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Zap size={20} strokeWidth={2} /></span>
                    <h1>Skill Library</h1>
                </div>
                <div className="assistant-page-workspace">
                    {/* Action buttons are inside SkillsManagerPanel's toolbar */}
                </div>
            </div>

            <SkillsManagerPanel />
        </div>
    );
}
