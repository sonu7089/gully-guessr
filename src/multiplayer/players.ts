import { PLAYER_COLORS } from '../components/mapPins';
import type { PlayerView, RoomView } from './protocol';

export const seatColor = (room: RoomView, uid: string) => PLAYER_COLORS[Math.max(0, room.players.findIndex((p) => p.uid === uid)) % PLAYER_COLORS.length];

export const playerName = (room: RoomView, uid: string, me: string | null) => (uid === me ? 'You' : (room.players.find((p) => p.uid === uid)?.name ?? 'Player'));

/** Highest total first; ties keep join order. */
export const standings = (room: RoomView): PlayerView[] => [...room.players].sort((a, b) => b.total - a.total);

export const inviteLink = (code: string) => `${location.origin}${location.pathname}?room=${code}`;
