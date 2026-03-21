import type { Peer } from "../types/peer.js";

export class MembershipService {
  private peers = new Map<string, Peer>();

  addOrUpdate(peer: Peer) {
    const now = Date.now();
    const existing = this.peers.get(peer.id);

    if (!existing || (peer.heartbeat > existing.heartbeat)) {
      this.peers.set(peer.id, {
        ...peer,
        lastSeen: now,
        alive: true
      });
      return true;
    }
    return false;
  }

  getPeers(excludeId?: string, onlyAlive = true): Peer[] {
    return Array.from(this.peers.values()).filter(p => {
      const isAlive = onlyAlive ? p.alive : true;
      const isNotSelf = !excludeId || p.id !== excludeId;
      return isAlive && isNotSelf;
    });
  }

  markDead(id: string) {
    const peer = this.peers.get(id);
    if (peer) {
      peer.alive = false;
    }
  }

  incrementHeartbeat(id: string) {
    const now = Date.now();
    const peer = this.peers.get(id);
    if (peer) {
      peer.heartbeat++;
      peer.lastSeen = now;
      peer.alive = true;
    }
  }
}
