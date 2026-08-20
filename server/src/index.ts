import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { FORGE_HOME, PORT, WEB_DIST } from './config.js';
import { api } from './routes/api.js';

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
  console.log(`the-forge dashboard  →  http://localhost:${PORT}`);
  console.log(`ledger               →  ${FORGE_HOME}`);
});
