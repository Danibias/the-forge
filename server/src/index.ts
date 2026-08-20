import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { HAS_API_KEY, MODEL, PORT, WEB_DIST } from './config.js';
import { api } from './routes/api.js';
import './db.js'; // opens and migrates the database at boot

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api', api);

// In production the built SPA is served from here; in dev, Vite proxies to us.
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`the-forge server  →  http://localhost:${PORT}  (model: ${MODEL})`);
  if (!HAS_API_KEY) {
    console.warn('!  ANTHROPIC_API_KEY is not set — chat will refuse until it is.');
  }
});
