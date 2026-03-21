import express from 'express';
import { MembershipService } from './services/membership.js';
import { GossipService } from './services/gossip.js';
import { FailureDetector } from './services/failure-detector.js';
import seedConfig from './config/seed-nodes.json' with { type: 'json' };
import type { Peer } from './types/peer.js';

function buildPeer(host: string, port: number): Peer {
    return {
        id: `${host}:${port}`,
        host,
        port,
        heartbeat: 0,
        lastSeen: Date.now(),
        alive: true
    };
}

export function createApp(port: number): express.Express {
    const app = express();
    app.use(express.json());

    const selfId = `localhost:${port}`;
    const now = Date.now();
    const membership = new MembershipService();
    const gossip = new GossipService(membership, selfId, port);
    const failureDetector = new FailureDetector(membership);

    // Register self
    membership.addOrUpdate({ ...buildPeer('localhost', port), lastSeen: now });

    // Register seed nodes
    seedConfig.seedNodes.forEach((node: { host: string; port: number }) => {
        const nodeId = `${node.host}:${node.port}`;
        // Don't add self to peers
        if (nodeId !== selfId) {
            membership.addOrUpdate({ ...buildPeer(node.host, node.port), lastSeen: now });
        }
    });

    app.post('/gossip', (req: express.Request, res: express.Response) => {
        const responseData = gossip.receive(req.body);
        res.json(responseData);
    });

    app.post('/message', (req: express.Request, res: express.Response) => {
        gossip.create(req.body);
        res.sendStatus(201);
    });

    gossip.start();
    failureDetector.start();

    return app;
}
