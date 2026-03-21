import axios from 'axios';
import { v4 as uuid } from 'uuid';
import type { MembershipService } from './membership.js';
import type { Peer } from '../types/peer.js';
import type { GossipMessage } from '../types/message.js';

type GossipState = {
    peers: Peer[];
    messages: GossipMessage[];
};

export class GossipService {
    private store = new Map<string, GossipMessage>();

    constructor(
        private membership: MembershipService,
        private selfId: string,
        private selfPort: number
    ) { }

    private getRandomPeer(peers: Peer[]): Peer | null {
        if (peers.length === 0) return null;
        return peers[Math.floor(Math.random() * peers.length)] ?? null;
    }

    private buildState(): GossipState {
        return {
            peers: this.membership.getPeers(undefined, false),
            messages: Array.from(this.store.values())
        };
    }


    create(payload: unknown) {
        const id = uuid();
        this.store.set(id, { id, payload, version: 1 });
    }

    async gossip() {
        const alivePeers = this.membership.getPeers(this.selfId, true);
        const deadPeers = this.membership.getPeers(this.selfId, false).filter(p => !p.alive);

        let randomPeer: Peer | null = null;
        if (Math.random() < 0.1 && deadPeers.length > 0) {
            randomPeer = this.getRandomPeer(deadPeers);
        } else {
            randomPeer = this.getRandomPeer(alivePeers);
        }

        if (!randomPeer) return;

        try {
            const payload = this.buildState();
            const response = await axios.post(
                `http://${randomPeer.host}:${randomPeer.port}/gossip`,
                payload
            );

            // Double gossip (Pull merge)
            if (response.data) {
                this.handleIncoming(response.data.peers, response.data.messages);
            }
        } catch (error) {
            // ignore network errors
        }
    }

    private handleIncoming(peers: Peer[] = [], messages: GossipMessage[] = []) {
        // Update membership info
        peers.forEach(peer => {
            if (peer && peer.id && peer.id !== this.selfId) {
                this.membership.addOrUpdate(peer);
            }
        });

        // Update application messages
        messages.forEach(msg => {
            if (msg && msg.id) {
                const existing = this.store.get(msg.id);
                if (!existing || msg.version > existing.version) {
                    this.store.set(msg.id, msg);
                }
            }
        });
    }

    receive(data: unknown): GossipState {
        try {
            if (!data) return this.buildState();

            console.log(`📥 Received gossip: ${Array.isArray(data) ? 'Array' : typeof data}`);

            if (Array.isArray(data)) {
                // Old format: [msg1, msg2]
                this.handleIncoming([], data as GossipMessage[]);
            } else if (
                typeof data === 'object' &&
                data !== null &&
                'messages' in data &&
                !('peers' in data)
            ) {
                // Transitional format: { messages: [] }
                const transitionalData = data as { messages?: GossipMessage[] };
                this.handleIncoming([], transitionalData.messages ?? []);
            } else if (typeof data === 'object' && data !== null) {
                // New format: { peers: [], messages: [] }
                const state = data as Partial<GossipState>;
                this.handleIncoming(state.peers ?? [], state.messages ?? []);
            }
        } catch (error) {
            console.error("❌ Error processing incoming gossip:", error);
        }

        return this.buildState();
    }

    async bootstrap() {
        // Actively contact seed nodes to bootstrap
        const peers = this.membership.getPeers(this.selfId);
        for (const peer of peers) {
            try {
                const payload = this.buildState();
                const response = await axios.post(
                    `http://${peer.host}:${peer.port}/gossip`,
                    payload
                );
                if (response.data) {
                    this.handleIncoming(response.data.peers, response.data.messages);
                }
            } catch (error) {
                // ignore errors during bootstrap
            }
        }
    }

    start() {
        // Bootstrap immediately with seed nodes
        this.bootstrap();

        // Periodically gossip with random peers
        setInterval(() => this.gossip(), 2000);

        // Increment own heartbeat to show alive status
        setInterval(() => {
            this.membership.incrementHeartbeat(this.selfId);
        }, 1000);
    }
}
