const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ SECURITY: Restrict CORS to frontend only (handle trailing slash)
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
app.use(cors({
  origin: (origin, callback) => {
    const normalizedOrigin = origin ? origin.replace(/\/$/, '') : '';
    if (normalizedOrigin === frontendUrl || !origin) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true
}));

app.use(express.json());

// ✅ SECURITY: Simple rate limiting for login attempts
const loginAttempts = new Map();
const rateLimit = (req, res, next) => {
  const ip = req.ip;
  const attempts = loginAttempts.get(ip) || 0;
  if (attempts > 5) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }
  next();
};

// ✅ SECURITY: Admin token verification
const adminToken = process.env.ADMIN_TOKEN || 'secure-token-change-in-production';
const verifyAdmin = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token === adminToken) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// In-memory database
let storedFeedbacks = [];
let activePublicKey = ''; // The CIT Office's public key (y)

// --- PUBLIC KEY ENDPOINTS ---
app.get('/api/public-key', (req, res) => {
  res.status(200).json({ publicKey: activePublicKey });
});

app.post('/api/public-key', verifyAdmin, (req, res) => {
  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: 'Missing public key' });
  activePublicKey = publicKey;
  console.log('CIT Admin updated the active Public Key.');
  res.status(200).json({ message: 'Public key successfully broadcasted.' });
});

// --- FEEDBACK ENDPOINTS ---
app.post('/api/feedback', (req, res) => {
  const { c1, c2Array, targetPubKey, studentName, submissionTimestamp } = req.body;
  if (!c1 || !c2Array || !targetPubKey) return res.status(400).json({ error: 'Missing encryption parameters' });

  const newFeedback = {
    id: Date.now(),
    studentName: studentName || 'Anonymous',
    c1,
    c2Array,
    targetPubKey,
    timestamp: submissionTimestamp || new Date().toLocaleString(),
    privateKeyUsed: null, // Will store which private key was used for decryption
  };

  storedFeedbacks.push(newFeedback);
  res.status(201).json({ message: 'Encrypted feedback stored.', feedback: newFeedback });
});

app.get('/api/feedback', verifyAdmin, (req, res) => {
  res.status(200).json(storedFeedbacks);
});

// --- DECRYPTION HISTORY ENDPOINT ---
app.post('/api/feedback/:id/decrypt-history', verifyAdmin, (req, res) => {
  const { privateKey } = req.body;
  const feedback = storedFeedbacks.find(f => f.id === parseInt(req.params.id));
  
  if (!feedback) return res.status(404).json({ error: 'Feedback not found' });
  
  // ✅ SECURITY: Don't store plaintext private key - just mark as decrypted
  feedback.decryptedAt = new Date().toLocaleTimeString();
  feedback.wasDecrypted = true;
  
  res.status(200).json({ message: 'Decryption history recorded', feedback });
});

// --- ADMIN LOGIN ENDPOINT ---
app.post('/api/login', rateLimit, (req, res) => {
  const ip = req.ip;
  const { username, password } = req.body;
  
  // ✅ SECURITY: Validate inputs
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    loginAttempts.delete(ip); // Reset on success
    return res.status(200).json({ success: true, token: adminToken });
  }
  
  // Track failed attempts
  loginAttempts.set(ip, (loginAttempts.get(ip) || 0) + 1);
  setTimeout(() => loginAttempts.delete(ip), 15 * 60 * 1000); // 15 min reset
  
  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

// --- HEALTH CHECK ---
app.get('/', (req, res) => {
  res.status(200).send('CIT ElGamal Backend API is running securely.');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`True Asymmetric E2EE Backend running on http://localhost:${PORT}`);
});