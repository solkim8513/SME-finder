require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Auto-migrate on cloud deployments
if (process.env.NODE_ENV === 'production') {
  require('./db/migrate')().catch(err => { console.error('Migration failed', err); process.exit(1); });
}

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3100' }));
app.use(express.json());

// Routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/smes',         require('./routes/smes'));
app.use('/api/sme-requests', require('./routes/smeRequests'));
app.use('/api/respond',      require('./routes/respond'));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Start scheduler
const { startScheduler } = require('./scheduler/reminderJob');
startScheduler();

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`SME Finder server running on port ${PORT}`));
