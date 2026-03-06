import type { Peer } from "../types/peer.js";

export class MembershipService {
  private peers = new Map<string, Peer>();

  addOrUpdate(peer: Peer) {
    const existing = this.peers.get(peer.id);

    if (!existing || (peer.heartbeat > existing.heartbeat)) {
      this.peers.set(peer.id, {
        ...peer,
        lastSeen: Date.now(),
        alive: true
      });
      return true;
    }
    return false;
  }

  getPeers(excludeId?: string, onlyAlive: boolean = true) {
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
    const peer = this.peers.get(id);
    if (peer) {
      peer.heartbeat++;
      peer.lastSeen = Date.now();
      peer.alive = true;
    }
  }
}
