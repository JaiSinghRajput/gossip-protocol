# 🚀 Gossip Protocol Server

A lightweight, robust implementation of a **Gossip Protocol** in TypeScript. This server uses an epidemic-style communication model to achieve distributed eventual consistency for both application data and cluster membership.

## ✨ Features

- **Push-Pull Gossip**: Hybrid communication for rapid convergence and anti-entropy.
- **Dynamic Membership**: Nodes learn about the entire cluster through word-of-mouth discovery.
- **Heartbeat-based Failure Detection**: Automatically detects and marks crashed nodes.
- **Self-Healing**: Periodically attempts to reconnect with dead nodes to handle transient failures.
- **Seed Discovery**: Bootstraps into the network using a configurable list of seed nodes.
- **TypeScript Native**: Full type safety and modern ESM support.

## 🏗️ Architecture

The system is composed of several decoupled services:

- **`MembershipService`**: The source of truth for the local node's view of the cluster. Tracks heartbeats and liveness.
- **`GossipService`**: The core engine that manages periodic gossip intervals and payload synchronization.
- **`FailureDetector`**: A background watchdog that monitors peer timestamps and manages liveness transitions.
- **`Express Server`**: Provides the HTTP interface for node-to-node gossip and client-to-node data submission.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (Recommended)

### Installation

```bash
pnpm install
```

### Building

```bash
pnpm run build
```

## 🎮 Running the Cluster

To see the protocol in action, you need to run multiple instances. Each instance should run on a different port.

Open multiple terminal windows and run:

```bash
# Terminal 1 (Seed Node)
pnpm run dev 8000

# Terminal 2 (Peer Node)
pnpm run dev 8001

# Terminal 3 (Peer Node)
pnpm run dev 8002
```

> **Note:** The default configuration in `src/config/seed-nodes.json` expects nodes on ports 8000, 8001, 8002, and 8003 to act as initial contact points.

## 📡 API Endpoints

### 1. `POST /message`
Add new data to the cluster. This data will eventually propagate to all nodes.
- **Payload**: `{ "any_key": "any_value" }`
- **Response**: `201 Created`

### 2. `POST /gossip` (Internal)
Used by nodes to exchange state.
- **Payload**: Object containing `peers` and `messages`.
- **Response**: The recipient's current state for pull-merge sync.

## 🧠 Protocol Details

### 💓 Heartbeats
Each node increments its own heartbeat every second. This heartbeat is gossiped across the network. If a node's heartbeat stops increasing, other nodes will eventually mark it as dead.

### 🔄 Push-Pull Exchange
When Node A gossips to Node B:
1. **Push**: Node A sends its entire known state to Node B.
2. **Merge**: Node B updates its membership and message store based on the latest version/heartbeat.
3. **Pull**: Node B returns its own current state to Node A in the response.
4. **Final Sync**: Node A updates its state from Node B's response.

This bi-directional exchange ensures that even if Node A is behind, it catches up instantly during its own push cycle.

### 🛡️ Failure Detection
The `FailureDetector` checks todos every 5 seconds. Any node that hasn't been "seen" (updated heartbeat) for more than 10 seconds is marked as `alive: false`. Nodes marked as dead are still gossiped about but are contacted less frequently.

## 📄 License
ISC
