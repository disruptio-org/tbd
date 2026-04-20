/* ─── Virtual Office Templates ─── */

export interface RoomTemplate {
    name: string;
    type: string;
    capacity: number;
    privacy: string;
    position: { x: number; y: number; w: number; h: number };
}

export interface OfficeTemplate {
    key: string;
    label: string;
    rooms: RoomTemplate[];
}

export const ROOM_TYPES = [
    { value: 'PRIVATE_OFFICE', label: 'Private Office', icon: 'user' },
    { value: 'MEETING_ROOM', label: 'Meeting Room', icon: 'users' },
    { value: 'CONFERENCE_ROOM', label: 'Conference Room', icon: 'presentation' },
    { value: 'OPEN_WORKSPACE', label: 'Open Workspace', icon: 'layout' },
    { value: 'LOUNGE', label: 'Lounge', icon: 'coffee' },
    { value: 'KITCHEN', label: 'Kitchen & Lounge', icon: 'utensils' },
] as const;

export const PRESENCE_STATES = [
    { value: 'online', label: 'Online', color: '#22c55e' },
    { value: 'in_office', label: 'In Office', color: '#3b82f6' },
    { value: 'in_room', label: 'In Room', color: '#2563eb' },
    { value: 'in_call', label: 'In Call', color: '#8b5cf6' },
    { value: 'dnd', label: 'Do Not Disturb', color: '#ef4444' },
    { value: 'away', label: 'Away', color: '#f59e0b' },
    { value: 'offline', label: 'Offline', color: '#94a3b8' },
] as const;

export const STARTUP_TEMPLATE: OfficeTemplate = {
    key: 'startup',
    label: 'Startup Office',
    rooms: [
        { name: 'CEO Office', type: 'PRIVATE_OFFICE', capacity: 2, privacy: 'private_locked', position: { x: 0, y: 0, w: 1, h: 1 } },
        { name: 'CTO Office', type: 'PRIVATE_OFFICE', capacity: 2, privacy: 'private_locked', position: { x: 1, y: 0, w: 1, h: 1 } },
        { name: 'Meeting Room', type: 'MEETING_ROOM', capacity: 6, privacy: 'public', position: { x: 2, y: 0, w: 1, h: 1 } },
        { name: 'Open Workspace', type: 'OPEN_WORKSPACE', capacity: 12, privacy: 'public', position: { x: 0, y: 1, w: 2, h: 1 } },
        { name: 'Lounge', type: 'LOUNGE', capacity: 8, privacy: 'public', position: { x: 2, y: 1, w: 1, h: 1 } },
        { name: 'Kitchen', type: 'KITCHEN', capacity: 6, privacy: 'public', position: { x: 3, y: 0, w: 1, h: 2 } },
    ],
};

export const TEMPLATES: OfficeTemplate[] = [STARTUP_TEMPLATE];

export function getTemplate(key: string): OfficeTemplate {
    return TEMPLATES.find(t => t.key === key) || STARTUP_TEMPLATE;
}
