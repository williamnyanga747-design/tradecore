import { GameInvitation, GameInvitationStatus } from '../types';

const BROADCAST_CHANNEL_NAME = 'tradecore_game_invitations_v1';

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  broadcastChannel = null;
}

function getApiUrl(): string {
  try {
    const custom = localStorage.getItem('tradecore_api_url');
    if (custom) return custom;
  } catch {}
  return '/cpanel/api.php';
}

function broadcastEvent(type: string, payload: any) {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type, payload, timestamp: Date.now() });
    } catch {}
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('tradecore_game_event', { detail: { type, payload } }));
    } catch {}
  }
}

/**
 * Send a new game invitation to a competitor
 */
export async function sendGameInvite(params: {
  senderId: string | number;
  senderName: string;
  senderUsername?: string;
  recipientId: string | number;
  recipientName: string;
  recipientUsername?: string;
  gameType: 'air_hockey' | 'arcade' | 'diy_pocket';
  gameTitle?: string;
  roomId?: string;
  timerMinutes?: number;
}): Promise<{ success: boolean; invitation?: GameInvitation; error?: string }> {
  try {
    const url = getApiUrl() + '?action=send_game_invite';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (data.success && data.invitation) {
      broadcastEvent('new_invite', data.invitation);
      return { success: true, invitation: data.invitation };
    }
    return { success: false, error: data.error || 'Failed to send invitation' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error sending invitation' };
  }
}

/**
 * Fetch invitations for the current user (both incoming pending and outgoing sent)
 */
export async function fetchGameInvites(params: {
  userId?: string | number;
  username?: string;
  inviteId?: string;
}): Promise<{
  success: boolean;
  list: GameInvitation[];
  pendingReceived: GameInvitation[];
  sent: GameInvitation[];
  pendingCount: number;
  invitation?: GameInvitation | null;
}> {
  try {
    const q = new URLSearchParams();
    q.set('action', 'get_game_invites');
    if (params.userId != null) q.set('user_id', String(params.userId));
    if (params.username) q.set('username', params.username);
    if (params.inviteId) q.set('invite_id', params.inviteId);

    const url = `${getApiUrl()}?${q.toString()}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      return {
        success: true,
        list: data.list || [],
        pendingReceived: data.pendingReceived || [],
        sent: data.sent || [],
        pendingCount: data.pendingCount || 0,
        invitation: data.invitation || null
      };
    }
    return { success: false, list: [], pendingReceived: [], sent: [], pendingCount: 0 };
  } catch {
    return { success: false, list: [], pendingReceived: [], sent: [], pendingCount: 0 };
  }
}

/**
 * Respond to an invitation (accept or decline)
 */
export async function respondGameInvite(
  inviteId: string,
  response: 'accept' | 'decline'
): Promise<{ success: boolean; invitation?: GameInvitation; error?: string }> {
  try {
    const url = getApiUrl() + '?action=respond_game_invite';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId, response })
    });
    const data = await res.json();
    if (data.success && data.invitation) {
      broadcastEvent('invite_response', data.invitation);
      return { success: true, invitation: data.invitation };
    }
    return { success: false, error: data.error || 'Failed to respond to invitation' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error responding to invitation' };
  }
}

/**
 * Cancel an outgoing invitation
 */
export async function cancelGameInvite(inviteId: string): Promise<boolean> {
  try {
    const url = getApiUrl() + '?action=cancel_game_invite';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId })
    });
    const data = await res.json();
    if (data.success) {
      broadcastEvent('invite_cancelled', { id: inviteId });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Listen for status changes on a specific invitation sent by this user.
 * Notifies the inviter immediately when the competitor accepts or declines!
 */
export function subscribeToSentInvite(
  inviteId: string,
  onStatusChange: (invitation: GameInvitation) => void
): () => void {
  let isDone = false;

  const handleMessage = (event: MessageEvent) => {
    if (isDone) return;
    const msg = event.data;
    if (msg?.type === 'invite_response' && msg.payload?.id === inviteId) {
      onStatusChange(msg.payload);
      if (['accepted', 'declined', 'cancelled', 'expired'].includes(msg.payload.status)) {
        isDone = true;
      }
    }
  };

  const handleCustomEvent = (e: Event) => {
    if (isDone) return;
    const detail = (e as CustomEvent).detail;
    if (detail?.type === 'invite_response' && detail.payload?.id === inviteId) {
      onStatusChange(detail.payload);
      if (['accepted', 'declined', 'cancelled', 'expired'].includes(detail.payload.status)) {
        isDone = true;
      }
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleMessage);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('tradecore_game_event', handleCustomEvent);
  }

  // Fast polling fallback (every 1s) to check remote server
  const intervalId = setInterval(async () => {
    if (isDone) {
      clearInterval(intervalId);
      return;
    }
    const result = await fetchGameInvites({ inviteId });
    if (result.success && result.invitation) {
      const inv = result.invitation;
      if (inv.status !== 'pending') {
        onStatusChange(inv);
        isDone = true;
        clearInterval(intervalId);
      }
    }
  }, 1000);

  return () => {
    isDone = true;
    clearInterval(intervalId);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('tradecore_game_event', handleCustomEvent);
    }
  };
}

/**
 * Subscribe to incoming invitations for a user (polls every 2.5s and listens to cross-tab broadcasts)
 */
export function subscribeToIncomingInvites(
  userId: string | number | undefined,
  username: string | undefined,
  onInvitesChange: (pendingInvites: GameInvitation[]) => void
): () => void {
  if (!userId && !username) return () => {};

  let isMounted = true;

  const checkInvites = async () => {
    if (!isMounted) return;
    const res = await fetchGameInvites({ userId, username });
    if (res.success && isMounted) {
      onInvitesChange(res.pendingReceived || []);
    }
  };

  // Initial check
  checkInvites();

  const handleMessage = (event: MessageEvent) => {
    const msg = event.data;
    if (msg?.type === 'new_invite' || msg?.type === 'invite_response' || msg?.type === 'invite_cancelled') {
      checkInvites();
    }
  };

  const handleCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.type === 'new_invite' || detail?.type === 'invite_response' || detail?.type === 'invite_cancelled') {
      checkInvites();
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleMessage);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('tradecore_game_event', handleCustomEvent);
  }

  const intervalId = setInterval(checkInvites, 2500);

  return () => {
    isMounted = false;
    clearInterval(intervalId);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('tradecore_game_event', handleCustomEvent);
    }
  };
}

/**
 * Multiplayer room synchronization for Air Hockey Pro across devices
 */
export async function syncGameRoom(
  roomId: string,
  role: 'host' | 'guest',
  statePayload?: {
    paddle?: { x: number; y: number };
    puck?: { x: number; y: number; vx: number; vy: number; speedMultiplier?: number };
    score?: { p1: number; p2: number };
    goal?: boolean;
  }
) {
  try {
    const url = getApiUrl() + '?action=game_room_sync';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomId, role, ...statePayload })
    });
    return await res.json();
  } catch {
    return null;
  }
}
