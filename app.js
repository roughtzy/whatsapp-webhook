// Import Express.js
const express = require('express');

// Create an Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Set port and verify_token
const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;

// In-memory store for delivered/failed statuses (cleared on fetch, restart, or redeploy)
const statusMessages = [];

// Route for GET requests
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK VERIFIED');
    res.status(200).send(challenge);
  } else {
    res.status(403).end();
  }
});

// Route for POST requests
app.post('/', (req, res) => {
  res.status(200).end(); // acknowledge immediately

  for (const entry of req.body?.entry || []) {
    for (const change of entry.changes || []) {
      for (const s of change.value?.statuses || []) {
        // Only keep delivered and failed; ignore sent, read, etc.
        if (s.status !== 'delivered' && s.status !== 'failed') continue;

        const isFailed = s.status === 'failed';
        const err = s.errors?.[0] || {};

        const record = {
          wamid: s.id,
          phone: s.recipient_id,
          status: s.status,
          errorCode: isFailed ? err.code ?? null : null,
          errorTitle: isFailed ? err.title ?? null : null,
          errorDetails: isFailed ? err.error_data?.details ?? null : null,
          timestamp: new Date(Number(s.timestamp) * 1000).toISOString(),
        };

        statusMessages.push(record);
        console.log('STATUS_MSG', JSON.stringify(record));
      }
    }
  }
});

// Fetch all collected statuses, then empty the store
// GET /status?key=YOUR_VERIFY_TOKEN
app.get('/status', (req, res) => {
  if (req.query.key !== verifyToken) return res.sendStatus(403);

  // splice removes everything from the array and returns it as a snapshot
  const records = statusMessages.splice(0, statusMessages.length);
  res.json({ count: records.length, statuses: records });
});

// Start the server
app.listen(port, () => {
  console.log(`\nListening on port ${port}\n`);
});
