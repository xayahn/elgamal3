'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// --- Math Utilities ---
const p = 2147483647n; 
const g = 16807n;      

const modExp = (base, exp, mod) => {
  let res = 1n; base = BigInt(base) % BigInt(mod); exp = BigInt(exp);
  while (exp > 0n) {
    if (exp % 2n === 1n) res = (res * base) % mod;
    exp = exp / 2n; base = (base * base) % mod;
  }
  return res;
};

const modInverse = (a, m) => {
  let m0 = BigInt(m), y = 0n, x = 1n;
  if (m === 1n) return 0n;
  let q, t; a = BigInt(a);
  while (a > 1n) {
    q = a / m0; t = m0; m0 = a % m0; a = t; t = y; y = x - q * y; x = t;
  }
  if (x < 0n) x += BigInt(m);
  return x;
};

export default function AdminPortal() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Key Management States
  const [privateKeyGen, setPrivateKeyGen] = useState('');
  const [auditLog, setAuditLog] = useState(null);
  const [activeServerKey, setActiveServerKey] = useState('');

  // Decryption States
  const [storedFeedbacks, setStoredFeedbacks] = useState([]);
  const [decryptKey, setDecryptKey] = useState(''); 
  const [decryptedResults, setDecryptedResults] = useState({});

  const fetchData = async () => {
    try {
      const [fbRes, pkRes] = await Promise.all([
        fetch('http://localhost:3001/api/feedback'),
        fetch('http://localhost:3001/api/public-key')
      ]);
      setStoredFeedbacks(await fbRes.json());
      const pkData = await pkRes.json();
      setActiveServerKey(pkData.publicKey);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn) fetchData();
  }, [isAdminLoggedIn]);

  const handlePublishKeys = async () => {
    if (!privateKeyGen || isNaN(privateKeyGen)) return alert("Enter a valid numeric private key.");
    const x = BigInt(privateKeyGen);
    if (x <= 1n || x >= p - 1n) return alert("Private key must be between 1 and p-1.");
    
    const y = modExp(g, x, p);
    
    // Publish Public Key to Server
    try {
      await fetch('http://localhost:3001/api/public-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: y.toString() })
      });
      
      setActiveServerKey(y.toString());
      setAuditLog({ prime: p.toString(), generator: g.toString(), privateX: x.toString(), publicY: y.toString() });
      alert("Public Key successfully published to the CIT Server!");
    } catch (e) {
      alert("Failed to publish key to server.");
    }
  };

  const handleDecrypt = (feedbackId) => {
    if (!decryptKey || isNaN(decryptKey)) return alert("Enter a valid decryption key.");
    const feedback = storedFeedbacks.find(f => f.id === feedbackId);
    const x = BigInt(decryptKey); 
    const c1 = BigInt(feedback.c1);
    
    try {
      const s = modExp(c1, x, p);
      const sInv = modInverse(s, p);
      const decryptedChars = feedback.c2Array.map(c2Str => {
        const c2 = BigInt(c2Str);
        const m = (c2 * sInv) % p;
        const num = Number(m);
        return (num >= 32 && num <= 126) ? String.fromCharCode(num) : ''; 
      });
      setDecryptedResults({ ...decryptedResults, [feedbackId]: decryptedChars.join('') });
    } catch (e) {
      setDecryptedResults({ ...decryptedResults, [feedbackId]: "Math Error." });
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/pubic-key`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (data.success) setIsAdminLoggedIn(true);
      else alert(data.error || 'Invalid credentials');
    } catch (error) {
      alert('Ensure backend is running on port 3001.');
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
        <Link href="/" className="mb-8 text-indigo-600 font-medium hover:underline flex items-center gap-2">&larr; Back to Student Portal</Link>
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-zinc-200 w-full max-w-sm">
          <h2 className="text-2xl font-extrabold text-zinc-900 mb-2">Staff Authentication</h2>
          <form onSubmit={handleAdminLogin} className="space-y-5 mt-6">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full border px-4 py-3 rounded-xl bg-zinc-50 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border px-4 py-3 rounded-xl bg-zinc-50 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button type="submit" className="w-full bg-zinc-900 text-white py-3.5 rounded-xl font-bold mt-2">Access Portal</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8 font-sans text-zinc-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="bg-zinc-900 text-white p-6 rounded-2xl shadow-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">CIT Admin Dashboard</h1>
            <p className="text-zinc-400 font-medium text-xs uppercase mt-1">Key Management & Decryption</p>
          </div>
          <div className="flex gap-4">
            <Link href="/" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-all">Student Portal</Link>
            <button onClick={() => setIsAdminLoggedIn(false)} className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-all">
              Sign Out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Section 1: Key Generation */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200">
            <h2 className="text-xl font-bold mb-6 text-zinc-800 flex items-center gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
              System Key Generation
            </h2>
            
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-300 p-4 rounded-xl text-sm font-mono mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              <div className="mb-3 border-b border-zinc-800 pb-3">
                <span className="text-indigo-400 font-bold">Formula:</span> Public Key (y) = g^x mod p
              </div>
              <div className="space-y-1 text-zinc-400">
                <p><span className="text-zinc-500">System Prime (p):</span> {p.toString()}</p>
                <p><span className="text-zinc-500">Generator (g):</span> {g.toString()}</p>
              </div>
            </div>

            <label className="block text-sm font-semibold text-zinc-700 mb-2">Master Private Key (x)</label>
            <input 
              type="number" value={privateKeyGen} onChange={(e) => setPrivateKeyGen(e.target.value)}
              className="w-full border border-zinc-300 px-4 py-3 rounded-xl bg-zinc-50 outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              placeholder="Set a secret master key (e.g., 8051)"
            />
            <button onClick={handlePublishKeys} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-sm mb-6">
              Generate & Publish Public Key
            </button>

            {auditLog && (
              <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-xl text-sm font-mono">
                <h3 className="font-bold text-zinc-800 mb-3 uppercase tracking-wider text-xs border-b border-zinc-200 pb-2">ElGamal Audit Log</h3>
                <div className="space-y-2">
                  <p><span className="text-zinc-500">Prime (p):</span> {auditLog.prime}</p>
                  <p><span className="text-zinc-500">Generator (g):</span> {auditLog.generator}</p>
                  <p><span className="text-indigo-600 font-bold">Generated (y):</span> <span className="break-all">{auditLog.publicY}</span></p>
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Decryption Dashboard */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 flex flex-col h-full">
            <h2 className="text-xl font-bold mb-6 text-zinc-800 flex items-center gap-2">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
              Database Decryption
            </h2>

            <div className="bg-zinc-900 border border-zinc-800 text-zinc-300 p-4 rounded-xl text-sm font-mono mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
              <span className="text-purple-400 font-bold">Formula:</span> m = c2 * (c1^x)^-1 mod p
            </div>

            <div className="mb-6 flex gap-3">
              <input 
                type="number" value={decryptKey} onChange={(e) => setDecryptKey(e.target.value)}
                className="flex-1 border border-zinc-300 px-4 py-3 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                placeholder="Enter private x to decrypt..."
              />
            </div>

            <div className="flex-1 overflow-auto space-y-4">
              {storedFeedbacks.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No secure payloads received yet.</p>
              ) : (
                storedFeedbacks.map(fb => (
                  <div key={fb.id} className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm hover:border-indigo-300 transition-colors">
                    <div className="flex justify-between items-center mb-4">
                      <span className="bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-md text-xs font-bold border border-zinc-200">ID: {fb.id}</span>
                      <button 
                        onClick={() => handleDecrypt(fb.id)} 
                        className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-4 py-1.5 rounded-lg font-bold transition-colors"
                      >
                        Decrypt Payload
                      </button>
                    </div>
                    
                    {/* UPDATED UI: Explicitly showing the Target Public Key for matching */}
                    <div className="text-xs font-mono text-zinc-500 bg-zinc-50 p-4 rounded-lg border border-zinc-100 mb-3 shadow-inner">
                      <div className="mb-3 border-b border-zinc-200 pb-3 flex flex-col gap-1">
                        <span className="text-indigo-600 font-bold uppercase tracking-wider text-[10px]">Encrypted Using Public Key (y):</span> 
                        <span className="text-zinc-800 font-medium break-all">{fb.targetPubKey}</span>
                      </div>
                      <div className="space-y-1">
                        <p><span className="text-zinc-400 font-medium">c1:</span> <span className="break-all">{fb.c1}</span></p>
                        <p><span className="text-zinc-400 font-medium">c2:</span> <span className="break-all">[{fb.c2Array[0]}, {fb.c2Array[1]}...]</span></p>
                      </div>
                    </div>

                    {decryptedResults[fb.id] && (
                      <div className={`mt-3 p-4 text-sm rounded-lg border leading-relaxed ${
                        decryptedResults[fb.id].includes('') || decryptedResults[fb.id] === "Math Error."
                          ? 'bg-red-50 text-red-900 border-red-200' 
                          : 'bg-emerald-50 text-emerald-900 border-emerald-200 font-medium'
                      }`}>
                        <strong className="block mb-1 opacity-80 uppercase tracking-wide text-xs">Decrypted Output:</strong>
                        {decryptedResults[fb.id]}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}