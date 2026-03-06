import { createApp } from './app.js';

const port = Number(process.argv[2]) || 8000;

const app = createApp(port);

app.listen(port, () => {
  console.log(`🚀 Gossip node running on ${port}`);
});
