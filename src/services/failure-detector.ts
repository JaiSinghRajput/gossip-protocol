import type { MembershipService } from "./membership.js";

export class FailureDetector {
  constructor(private membership: MembershipService) {}

  start() {
    setInterval(() => {
      const peers = this.membership.getPeers();

      peers.forEach(peer => {
        if (Date.now() - peer.lastSeen > 10000) {
          this.membership.markDead(peer.id);
        }
      });
    }, 5000);
  }
}
