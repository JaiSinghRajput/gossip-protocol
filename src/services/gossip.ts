import axios from 'axios';
import { v4 as uuid } from 'uuid';
import type { MembershipService } from './membership.js';
import type { Peer } from '../types/peer.js';

export class GossipService {
    private store = new Map<string, any>();

    constructor(
        private membership: MembershipService,
        private selfId: string,
        private selfPort: number
    ) { }

    private getRandomPeer(peers: Peer[]): Peer | null {
        if (peers.length === 0) return null;
        return peers[Math.floor(Math.random() * peers.length)] ?? null;
    }


    create(payload: any) {
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
            const response = await axios.post(
                `http://${randomPeer.host}:${randomPeer.port}/gossip`,
                {
                    peers: this.membership.getPeers(undefined, false), // Send ALIVE AND DEAD peers
                    messages: Array.from(this.store.values())
                }
            );

            // Double gossip (Pull merge)
            if (response.data) {
                this.handleIncoming(response.data.peers, response.data.messages);
            }
        } catch (error) {
            // ignore network errors
        }
    }

    private handleIncoming(peers: Peer[], messages: any[]) {
        // Update membership info
        if (peers && Array.isArray(peers)) {
            peers.forEach(peer => {
                if (peer && peer.id && peer.id !== this.selfId) {
                    this.membership.addOrUpdate(peer);
                }
            });
        }

        // Update application messages
        if (messages && Array.isArray(messages)) {
            messages.forEach(msg => {
                if (msg && msg.id) {
                    const existing = this.store.get(msg.id);
                    if (!existing || msg.version > existing.version) {
                        this.store.set(msg.id, msg);
                    }
                }
            });
        }
    }

    private getState() {
        return {
            peers: this.membership.getPeers(undefined, false),
            messages: Array.from(this.store.values())
        };
    }

    receive(data: any) {
        try {
            if (!data) return this.getState();

            console.log(`📥 Received gossip: ${Array.isArray(data) ? 'Array' : typeof data}`);

            if (Array.isArray(data)) {
                // Old format: [msg1, msg2]
                this.handleIncoming([], data);
            } else if (data.messages && !data.peers) {
                // Transitional format: { messages: [] }
                this.handleIncoming([], data.messages);
            } else {
                // New format: { peers: [], messages: [] }
                this.handleIncoming(data.peers, data.messages);
            }
        } catch (error) {
            console.error("❌ Error processing incoming gossip:", error);
        }

        return this.getState();
    }

    async bootstrap() {
        // Actively contact seed nodes to bootstrap
        const peers = this.membership.getPeers(this.selfId);
        for (const peer of peers) {
            try {
                const response = await axios.post(
                    `http://${peer.host}:${peer.port}/gossip`,
                    {
                        peers: this.membership.getPeers(undefined, false),
                        messages: Array.from(this.store.values())
                    }
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
