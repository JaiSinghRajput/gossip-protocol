import express from 'express';
import { v4 as uuid } from 'uuid';
import { MembershipService } from './services/membership.js';
import { GossipService } from './services/gossip.js';
import { FailureDetector } from './services/failure-detector.js';
import seedConfig from './config/seed-nodes.json' with { type: 'json' };

export function createApp(port: number): express.Express {
    const app = express();
    app.use(express.json());

    const selfId = `localhost:${port}`;
    const membership = new MembershipService();
    const gossip = new GossipService(membership, selfId, port);
    const failureDetector = new FailureDetector(membership);

    // Register self
    membership.addOrUpdate({
        id: selfId,
        host: 'localhost',
        port: port,
        heartbeat: 0,
        lastSeen: Date.now(),
        alive: true
    });

    // Register seed nodes
    seedConfig.seedNodes.forEach((node: any) => {
        const nodeId = `${node.host}:${node.port}`;
        // Don't add self to peers
        if (nodeId !== selfId) {
            membership.addOrUpdate({
                id: nodeId,
                host: node.host,
                port: node.port,
                heartbeat: 0,
                lastSeen: Date.now(),
                alive: true
            });
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
