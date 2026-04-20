'use client';

import React from 'react';
import type { CompatibilityState } from '@/lib/skills/types';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

interface CompatibilityBadgeProps {
    state: CompatibilityState | string;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    tooltip?: string;
}

const STATE_CONFIG: Record<string, {
    icon: React.ElementType;
    color: string;
    bg: string;
    label: string;
}> = {
    FULLY_COMPATIBLE: {
        icon: CheckCircle2,
        color: '#16C79A',
        bg: 'rgba(22, 199, 154, 0.12)',
        label: 'Fully Compatible',
    },
    COMPATIBLE_DEGRADED: {
        icon: AlertTriangle,
        color: '#F5A623',
        bg: 'rgba(245, 166, 35, 0.12)',
        label: 'Degraded',
    },
    INCOMPATIBLE: {
        icon: XCircle,
        color: '#E94560',
        bg: 'rgba(233, 69, 96, 0.12)',
        label: 'Incompatible',
    },
    UNKNOWN: {
        icon: HelpCircle,
        color: '#94A3B8',
        bg: 'rgba(148, 163, 184, 0.12)',
        label: 'Unknown',
    },
};

const SIZE_MAP = {
    sm: { icon: 12, font: '10px', padding: '2px 6px', gap: '3px' },
    md: { icon: 14, font: '11px', padding: '3px 8px', gap: '5px' },
    lg: { icon: 16, font: '12px', padding: '4px 10px', gap: '6px' },
};

/**
 * Badge showing the compatibility state of a skill or run.
 */
export function CompatibilityBadge({
    state,
    size = 'md',
    showLabel = true,
    tooltip,
}: CompatibilityBadgeProps) {
    const config = STATE_CONFIG[state] || STATE_CONFIG.UNKNOWN;
    const sizeConfig = SIZE_MAP[size];
    const IconComponent = config.icon;

    return (
        <span
            title={tooltip || config.label}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: sizeConfig.gap,
                padding: sizeConfig.padding,
                borderRadius: '4px',
                background: config.bg,
                color: config.color,
                fontSize: sizeConfig.font,
                fontWeight: 600,
                letterSpacing: '0.3px',
                lineHeight: 1,
                cursor: tooltip ? 'help' : 'default',
                whiteSpace: 'nowrap',
            }}
        >
            <IconComponent size={sizeConfig.icon} />
            {showLabel && config.label}
        </span>
    );
}
