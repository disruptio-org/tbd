'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Building2, Users, Search, Mic, MicOff, Camera, CameraOff,
    Headphones, LogOut, Settings, Plus, Send, Lock,
    Coffee, Monitor, MessageSquare, DoorOpen, UserCircle,
    CircleDot, RefreshCw,
} from 'lucide-react';
import './virtual-office.css';

/* ─── Types ─── */

interface Room {
    id: string;
    name: string;
    type: string;
    capacity: number;
    privacy: string;
    position: { x: number; y: number; w: number; h: number } | null;
    isActive: boolean;
    occupants: Presence[];
}

interface Presence {
    id: string;
    userId: string;
    companyId: string;
    roomId: string | null;
    status: string;
    audioState: string;
    videoState: string;
    lastSeenAt: string;
}

interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
}

interface RoomMessage {
    id: string;
    roomId: string;
    userId: string;
    content: string;
    createdAt: string;
}

/* ─── Helpers ─── */

function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function getRoomIcon(type: string) {
    switch (type) {
        case 'PRIVATE_OFFICE': return <Lock size={14} />;
        case 'MEETING_ROOM': return <Users size={14} />;
        case 'CONFERENCE_ROOM': return <Monitor size={14} />;
        case 'OPEN_WORKSPACE': return <DoorOpen size={14} />;
        case 'LOUNGE': return <Coffee size={14} />;
        case 'KITCHEN': return <Coffee size={14} />;
        default: return <Building2 size={14} />;
    }
}

function getRoomStatus(room: Room) {
    const count = room.occupants?.length || 0;
    if (room.privacy === 'private_locked') return 'locked';
    if (count === 0) return 'available';
    if (count >= room.capacity) return 'in-meeting';
    return 'occupied';
}

function getStatusLabel(status: string) {
    return status.replace(/-/g, ' ').replace(/_/g, ' ');
}

function getPresenceColor(status: string) {
    switch (status) {
        case 'online': case 'in_office': return '#22c55e';
        case 'in_room': return '#2563eb';
        case 'in_call': return '#8b5cf6';
        case 'dnd': return '#ef4444';
        case 'away': return '#f59e0b';
        default: return '#94a3b8';
    }
}

/* ─── Component ─── */

export default function VirtualOfficePage() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [presence, setPresence] = useState<Presence[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'office' | 'rooms'>('office');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [micOn, setMicOn] = useState(false);
    const [camOn, setCamOn] = useState(false);
    const [myStatus, setMyStatus] = useState('in_office');
    const [showAdmin, setShowAdmin] = useState(false);
    const [messages, setMessages] = useState<RoomMessage[]>([]);
    const [msgInput, setMsgInput] = useState('');
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomType, setNewRoomType] = useState('MEETING_ROOM');
    const [newRoomCapacity, setNewRoomCapacity] = useState(8);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval>>(null);

    // Fetch office data
    const fetchOffice = useCallback(async () => {
        try {
            const res = await fetch('/api/virtual-office');
            if (!res.ok) return;
            const data = await res.json();
            if (data.office?.rooms) setRooms(data.office.rooms);
            if (data.presence) setPresence(data.presence);
            if (data.users) setUsers(data.users);
            // Determine current room
            const myPresence = data.presence?.find((p: Presence) =>
                data.users?.some((u: User) => u.id === p.userId)
            );
            if (myPresence?.roomId) setCurrentRoomId(myPresence.roomId);
        } catch { /* handled */ }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchOffice();
        // Poll for presence updates every 5s
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch('/api/virtual-office/presence');
                if (res.ok) {
                    const data = await res.json();
                    setPresence(data.presence || []);
                }
            } catch { /* handled */ }
        }, 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [fetchOffice]);

    // Fetch room messages when in a room
    useEffect(() => {
        if (!currentRoomId) { setMessages([]); return; }
        const fetchMsgs = async () => {
            try {
                const res = await fetch(`/api/virtual-office/rooms/${currentRoomId}/messages`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.messages || []);
                }
            } catch { /* handled */ }
        };
        fetchMsgs();
        const iv = setInterval(fetchMsgs, 3000);
        return () => clearInterval(iv);
    }, [currentRoomId]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Actions
    const joinRoom = async (roomId: string) => {
        try {
            const res = await fetch(`/api/virtual-office/rooms/${roomId}/join`, { method: 'POST' });
            if (res.ok) {
                setCurrentRoomId(roomId);
                setSelectedRoomId(roomId);
                setMyStatus('in_room');
                fetchOffice();
            }
        } catch { /* handled */ }
    };

    const leaveRoom = async () => {
        if (!currentRoomId) return;
        try {
            const res = await fetch(`/api/virtual-office/rooms/${currentRoomId}/leave`, { method: 'POST' });
            if (res.ok) {
                setCurrentRoomId(null);
                setMyStatus('in_office');
                fetchOffice();
            }
        } catch { /* handled */ }
    };

    const sendMessage = async () => {
        if (!msgInput.trim() || !currentRoomId) return;
        try {
            await fetch(`/api/virtual-office/rooms/${currentRoomId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: msgInput.trim() }),
            });
            setMsgInput('');
            // Re-fetch messages
            const res = await fetch(`/api/virtual-office/rooms/${currentRoomId}/messages`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }
        } catch { /* handled */ }
    };

    const createRoom = async () => {
        if (!newRoomName.trim()) return;
        try {
            const res = await fetch('/api/virtual-office/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newRoomName, type: newRoomType, capacity: newRoomCapacity }),
            });
            if (res.ok) {
                setNewRoomName('');
                setShowAdmin(false);
                fetchOffice();
            }
        } catch { /* handled */ }
    };

    const updateStatus = async (status: string) => {
        setMyStatus(status);
        try {
            await fetch('/api/virtual-office/presence', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
        } catch { /* handled */ }
    };

    const getUserById = (userId: string) => users.find(u => u.id === userId);
    const getPresenceForUser = (userId: string) => presence.find(p => p.userId === userId);

    const filteredRooms = searchQuery
        ? rooms.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : rooms;

    const filteredUsers = searchQuery
        ? users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : users;

    const selectedRoom = rooms.find(r => r.id === (selectedRoomId || currentRoomId));
    const currentRoom = rooms.find(r => r.id === currentRoomId);

    if (loading) {
        return (
            <div className="vo-page">
                <div className="vo-header"><div className="vo-header-title">Virtual Office</div></div>
                <div className="vo-center" style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <div className="vo-empty"><RefreshCw size={32} className="vo-empty-icon" /><span>Loading office...</span></div>
                </div>
            </div>
        );
    }

    return (
        <div className="vo-page">
            {/* ── HEADER ── */}
            <div className="vo-header">
                <div>
                    <div className="vo-header-title">Virtual Office</div>
                    <div className="vo-header-subtitle">
                        {rooms.length} rooms · {presence.filter(p => p.status !== 'offline').length} online · {users.length} members
                    </div>
                </div>
                <div className="vo-header-actions">
                    <button className="vo-btn-secondary" onClick={() => fetchOffice()}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                    <button className="vo-btn-primary" onClick={() => setShowAdmin(true)}>
                        <Plus size={13} /> Add Room
                    </button>
                </div>
            </div>

            {/* ── LEFT PANEL ── */}
            <div className="vo-left">
                <div className="vo-search-box">
                    <input
                        className="vo-search-input"
                        placeholder="Search rooms & people..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="vo-section-label">Rooms</div>
                <ul className="vo-room-list">
                    {filteredRooms.map(room => {
                        const status = getRoomStatus(room);
                        const isCurrentRoom = room.id === currentRoomId;
                        return (
                            <li
                                key={room.id}
                                className={`vo-room-list-item ${isCurrentRoom ? 'active' : ''}`}
                                onClick={() => setSelectedRoomId(room.id)}
                            >
                                <span className="vo-room-dot" style={{ background: getPresenceColor(isCurrentRoom ? 'in_room' : status === 'available' ? 'online' : 'in_call') }} />
                                {getRoomIcon(room.type)}
                                <span>{room.name}</span>
                                <span className="vo-room-count">{room.occupants?.length || 0}/{room.capacity}</span>
                            </li>
                        );
                    })}
                </ul>

                <div className="vo-section-label">People</div>
                <ul className="vo-member-list">
                    {filteredUsers.map(user => {
                        const pres = getPresenceForUser(user.id);
                        const inRoom = pres?.roomId ? rooms.find(r => r.id === pres.roomId)?.name : null;
                        return (
                            <li key={user.id} className="vo-member-item">
                                <div className="vo-member-avatar">
                                    {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} /> : getInitials(user.name)}
                                </div>
                                <div className="vo-member-info">
                                    <div className="vo-member-name">{user.name}</div>
                                    <div className="vo-member-status">{inRoom || getStatusLabel(pres?.status || 'offline')}</div>
                                </div>
                                <span className="vo-presence-dot" style={{ background: getPresenceColor(pres?.status || 'offline') }} />
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* ── CENTER: OFFICE MAP ── */}
            <div className="vo-center">
                <div className="vo-tabs">
                    <button className={`vo-tab-btn ${activeTab === 'office' ? 'active' : ''}`} onClick={() => setActiveTab('office')}>
                        <Building2 size={13} /> Office
                    </button>
                    <button className={`vo-tab-btn ${activeTab === 'rooms' ? 'active' : ''}`} onClick={() => setActiveTab('rooms')}>
                        <DoorOpen size={13} /> Rooms
                    </button>
                </div>

                {activeTab === 'office' && (
                    <div className="vo-map">
                        {filteredRooms.map(room => {
                            const status = getRoomStatus(room);
                            const isCurrentRoom = room.id === currentRoomId;
                            const isSelected = room.id === selectedRoomId;
                            const cardClasses = [
                                'vo-room-card',
                                status === 'locked' ? 'locked' : '',
                                isCurrentRoom ? 'current-room' : '',
                                (room.occupants?.length || 0) > 0 && !isCurrentRoom ? 'occupied' : '',
                                isSelected ? 'active-room' : '',
                            ].filter(Boolean).join(' ');

                            return (
                                <div
                                    key={room.id}
                                    className={cardClasses}
                                    onClick={() => setSelectedRoomId(room.id)}
                                    style={{
                                        gridColumn: room.position ? `${(room.position as any).x + 1} / span ${(room.position as any).w}` : undefined,
                                        gridRow: room.position ? `${(room.position as any).y + 1} / span ${(room.position as any).h}` : undefined,
                                    }}
                                >
                                    <div className="vo-room-card-header">
                                        <div className="vo-room-card-name">{room.name}</div>
                                        <span className="vo-room-card-type">{room.type.replace(/_/g, ' ')}</span>
                                    </div>
                                    <div className="vo-room-card-body">
                                        {(room.occupants?.length || 0) > 0 && (
                                            <div className="vo-room-avatars">
                                                {room.occupants.slice(0, 5).map(occ => {
                                                    const u = getUserById(occ.userId);
                                                    return (
                                                        <div key={occ.id} className="vo-room-avatar-small" title={u?.name || 'User'}>
                                                            {u?.avatarUrl ? <img src={u.avatarUrl} alt={u.name} /> : getInitials(u?.name || '?')}
                                                        </div>
                                                    );
                                                })}
                                                {(room.occupants?.length || 0) > 5 && (
                                                    <div className="vo-room-avatar-small vo-room-avatar-overflow">
                                                        +{room.occupants.length - 5}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="vo-room-card-footer">
                                        <span className="vo-room-capacity">{room.occupants?.length || 0}/{room.capacity}</span>
                                        <span className={`vo-room-status-badge ${status}`}>{getStatusLabel(status)}</span>
                                    </div>
                                    {!isCurrentRoom && status !== 'locked' && (
                                        <button className="vo-join-btn" onClick={e => { e.stopPropagation(); joinRoom(room.id); }}>
                                            Join
                                        </button>
                                    )}
                                    {isCurrentRoom && (
                                        <button className="vo-leave-btn" onClick={e => { e.stopPropagation(); leaveRoom(); }}>
                                            Leave
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'rooms' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {filteredRooms.map(room => {
                            const status = getRoomStatus(room);
                            const isCurrentRoom = room.id === currentRoomId;
                            return (
                                <div
                                    key={room.id}
                                    className={`vo-room-list-item ${isCurrentRoom ? 'active' : ''}`}
                                    style={{ borderBottom: '2px solid var(--color-stroke-subtle, #e2e8f0)', padding: '12px 16px' }}
                                    onClick={() => setSelectedRoomId(room.id)}
                                >
                                    {getRoomIcon(room.type)}
                                    <span style={{ fontWeight: 900, flex: 1 }}>{room.name}</span>
                                    <span className="vo-room-type-badge">{room.type.replace(/_/g, ' ')}</span>
                                    <span className="vo-room-count" style={{ minWidth: 36 }}>{room.occupants?.length || 0}/{room.capacity}</span>
                                    <span className={`vo-room-status-badge ${status}`}>{getStatusLabel(status)}</span>
                                    {!isCurrentRoom && status !== 'locked' && (
                                        <button className="vo-join-btn" onClick={e => { e.stopPropagation(); joinRoom(room.id); }}>Join</button>
                                    )}
                                    {isCurrentRoom && (
                                        <button className="vo-leave-btn" onClick={e => { e.stopPropagation(); leaveRoom(); }}>Leave</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── RIGHT PANEL ── */}
            <div className="vo-right">
                {/* Room detail */}
                {selectedRoom ? (
                    <div className="vo-context-card">
                        <div className="vo-context-title">{selectedRoom.name}</div>
                        <div className="vo-context-item">{getRoomIcon(selectedRoom.type)} <span>{selectedRoom.type.replace(/_/g, ' ')}</span></div>
                        <div className="vo-context-item"><Users size={12} /> <span>{selectedRoom.occupants?.length || 0} / {selectedRoom.capacity} capacity</span></div>
                        <div className="vo-context-item"><Lock size={12} /> <span>{selectedRoom.privacy.replace(/_/g, ' ')}</span></div>
                        <div className="vo-context-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                            <span style={{ fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Members</span>
                            {selectedRoom.occupants?.map(occ => {
                                const u = getUserById(occ.userId);
                                return (
                                    <div key={occ.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                                        <span className="vo-presence-dot" style={{ background: getPresenceColor(occ.status) }} />
                                        {u?.name || 'User'}
                                    </div>
                                );
                            })}
                            {(!selectedRoom.occupants || selectedRoom.occupants.length === 0) && (
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>No one here</span>
                            )}
                        </div>
                        {selectedRoom.id !== currentRoomId && selectedRoom.privacy !== 'private_locked' && (
                            <button className="vo-btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={() => joinRoom(selectedRoom.id)}>
                                <DoorOpen size={13} /> Join Room
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="vo-context-card">
                        <div className="vo-context-title">Room Details</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Select a room to view details</div>
                    </div>
                )}

                {/* My info */}
                <div className="vo-context-card">
                    <div className="vo-context-title">Your Status</div>
                    <div className="vo-context-item">
                        <UserCircle size={14} />
                        <span style={{ flex: 1 }}>Status</span>
                        <select
                            value={myStatus}
                            onChange={e => updateStatus(e.target.value)}
                            style={{ border: '2px solid #e2e8f0', padding: '4px 8px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderRadius: 0 }}
                        >
                            <option value="online">Online</option>
                            <option value="in_office">In Office</option>
                            <option value="dnd">Do Not Disturb</option>
                            <option value="away">Away</option>
                        </select>
                    </div>
                    <div className="vo-context-item">
                        <CircleDot size={14} />
                        <span>Current room: {currentRoom?.name || 'Lobby'}</span>
                    </div>
                </div>

                {/* Room Chat (when in room) */}
                {currentRoomId && (
                    <div className="vo-chat-panel">
                        <div className="vo-section-label" style={{ padding: '8px 14px', borderBottom: '1px solid #e2e8f0' }}>
                            <MessageSquare size={12} /> Room Chat
                        </div>
                        <div className="vo-chat-messages">
                            {messages.length === 0 && (
                                <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 16 }}>No messages yet</div>
                            )}
                            {messages.map(msg => {
                                const author = getUserById(msg.userId);
                                return (
                                    <div key={msg.id} className="vo-chat-msg">
                                        <span className="vo-chat-msg-author">{author?.name?.split(' ')[0] || 'User'}</span>
                                        <span className="vo-chat-msg-text">{msg.content}</span>
                                        <span className="vo-chat-msg-time">
                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="vo-chat-input-row">
                            <input
                                className="vo-chat-input"
                                placeholder="Type a message..."
                                value={msgInput}
                                onChange={e => setMsgInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                            />
                            <button className="vo-chat-send-btn" onClick={sendMessage}><Send size={12} /></button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── BOTTOM BAR ── */}
            <div className="vo-bottom-bar">
                <div className="vo-bar-left">
                    <span className="vo-bar-status">
                        <span className="vo-presence-dot" style={{ background: getPresenceColor(myStatus) }} />
                        {getStatusLabel(myStatus)}
                    </span>
                    {currentRoom && (
                        <span className="vo-bar-room-label">{currentRoom.name}</span>
                    )}
                </div>
                <div className="vo-bar-center">
                    <button className={`vo-bar-btn ${micOn ? 'active' : ''}`} onClick={() => setMicOn(!micOn)} title="Mic">
                        {micOn ? <Mic size={16} /> : <MicOff size={16} />}
                    </button>
                    <button className={`vo-bar-btn ${camOn ? 'active' : ''}`} onClick={() => setCamOn(!camOn)} title="Camera">
                        {camOn ? <Camera size={16} /> : <CameraOff size={16} />}
                    </button>
                    <button className="vo-bar-btn" title="Audio">
                        <Headphones size={16} />
                    </button>
                </div>
                <div className="vo-bar-right">
                    {currentRoomId && (
                        <button className="vo-bar-btn danger" onClick={leaveRoom} title="Leave Room">
                            <LogOut size={16} />
                        </button>
                    )}
                    <button className="vo-bar-btn" onClick={() => setShowAdmin(true)} title="Settings">
                        <Settings size={16} />
                    </button>
                </div>
            </div>

            {/* ── ADMIN MODAL ── */}
            {showAdmin && (
                <div className="vo-admin-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAdmin(false); }}>
                    <div className="vo-admin-modal">
                        <div className="vo-admin-title">Add New Room</div>
                        <div className="vo-admin-field">
                            <label className="vo-admin-label">Room Name</label>
                            <input
                                className="vo-admin-input"
                                value={newRoomName}
                                onChange={e => setNewRoomName(e.target.value)}
                                placeholder="e.g. Design Studio"
                            />
                        </div>
                        <div className="vo-admin-field">
                            <label className="vo-admin-label">Room Type</label>
                            <select className="vo-admin-select" value={newRoomType} onChange={e => setNewRoomType(e.target.value)}>
                                <option value="PRIVATE_OFFICE">Private Office</option>
                                <option value="MEETING_ROOM">Meeting Room</option>
                                <option value="CONFERENCE_ROOM">Conference Room</option>
                                <option value="OPEN_WORKSPACE">Open Workspace</option>
                                <option value="LOUNGE">Lounge</option>
                                <option value="KITCHEN">Kitchen & Lounge</option>
                            </select>
                        </div>
                        <div className="vo-admin-field">
                            <label className="vo-admin-label">Capacity</label>
                            <input
                                className="vo-admin-input"
                                type="number"
                                value={newRoomCapacity}
                                onChange={e => setNewRoomCapacity(Number(e.target.value))}
                                min={1}
                                max={50}
                            />
                        </div>
                        <div className="vo-admin-actions">
                            <button className="vo-btn-primary" onClick={createRoom}>
                                <Plus size={13} /> Create Room
                            </button>
                            <button className="vo-btn-secondary" onClick={() => setShowAdmin(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
