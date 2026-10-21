import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createExpressApp } from './backend/app.js';
import { initDatabase } from './backend/db/index.js';
import { seedDatabase } from './backend/seed.js';

const appDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// Global crash protection
process.on('uncaughtException', (err) => {
  console.error('[Process Error] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process Error] Unhandled Rejection at:', promise, 'reason:', reason);
});

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const app = createExpressApp();

  // Initialize database and seed initial catalog/ledger
  await initDatabase();
  await seedDatabase();

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Server] Mounting Vite development middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Server] Serving production static files from dist...');
    const distPath = path.join(appDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Field Service Stock System running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal error on startup:', err);
  process.exit(1);
});
