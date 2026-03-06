export type Peer = {
  id: string;
  host: string;
  port: number;
  heartbeat: number;
  lastSeen: number;
  alive: boolean;
};
