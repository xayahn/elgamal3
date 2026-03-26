const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-memory database
let storedFeedbacks = [];
let activePublicKey = ''; // The CIT Office's public key (y)

// --- PUBLIC KEY ENDPOINTS ---
app.get('/api/public-key', (req, res) => {
  res.status(200).json({ publicKey: activePublicKey });
});

app.post('/api/public-key', (req, res) => {
  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: 'Missing public key' });
  activePublicKey = publicKey;
  console.log('CIT Admin updated the active Public Key.');
  res.status(200).json({ message: 'Public key successfully broadcasted.' });
});

// --- FEEDBACK ENDPOINTS ---
app.post('/api/feedback', (req, res) => {
  const { c1, c2Array, targetPubKey } = req.body;
  if (!c1 || !c2Array || !targetPubKey) return res.status(400).json({ error: 'Missing encryption parameters' });

  const newFeedback = {
    id: Date.now(),
    c1,
    c2Array,
    targetPubKey,
    timestamp: new Date().toLocaleTimeString(),
  };

  storedFeedbacks.push(newFeedback);
  res.status(201).json({ message: 'Encrypted feedback stored.', feedback: newFeedback });
});

app.get('/api/feedback', (req, res) => {
  res.status(200).json(storedFeedbacks);
});

// --- ADMIN LOGIN ENDPOINT ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    return res.status(200).json({ success: true });
  }
  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`True Asymmetric E2EE Backend running on http://localhost:${PORT}`);
});