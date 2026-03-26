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

export default function StudentPortal() {
  const [adminPublicKey, setAdminPublicKey] = useState('');   
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('Checking server for keys...');

  // Automatically fetch the Public Key on load
  const fetchPublicKey = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/public-key');
      const data = await response.json();
      if (data.publicKey) {
        setAdminPublicKey(data.publicKey);
        setStatus('Secure Connection Established (Key Fetched)');
      } else {
        setStatus('Server Public Key not found. Admin must generate one.');
      }
    } catch (error) {
      setStatus('Failed to connect to CIT Server.');
    }
  };

  useEffect(() => {
    fetchPublicKey();
  }, []);

  const handleEncryptSubmit = async () => {
    if (!adminPublicKey) return alert("System error: No public key available to encrypt your data.");
    if (!message) return alert("Message cannot be empty.");

    // The Student uses the ADMIN's Public Key (y) to encrypt
    const k = BigInt(Math.floor(Math.random() * 1000000) + 2); 
    const y = BigInt(adminPublicKey);
    const c1 = modExp(g, k, p);
    const s = modExp(y, k, p);
    
    const mArray = message.split('').map(char => BigInt(char.charCodeAt(0)));
    const c2Array = mArray.map(m => (m * s) % p);

    const payload = {
      c1: c1.toString(),
      c2Array: c2Array.map(c => c.toString()),
      targetPubKey: adminPublicKey
    };

    try {
      await fetch('http://localhost:3001/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setMessage('');
      alert("Encrypted feedback securely transmitted to CIT Server!");
    } catch (error) {
      alert("Submission failed. Check network.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8 font-sans text-zinc-900">
      <div className="max-w-3xl mx-auto space-y-8">
        
        <header className="bg-zinc-900 text-white p-6 rounded-2xl shadow-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">CIT Office Student Feedback</h1>
            <p className="text-zinc-400 font-medium text-xs uppercase mt-1">ElGamal Encryption System</p>
          </div>
          <Link href="/admin" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-all">
            Staff Login &rarr;
          </Link>
        </header>

        <section className="bg-white p-8 rounded-2xl shadow-sm border border-zinc-200">
          
          {/* Key Status Indicator */}
          <div className={`mb-8 p-4 rounded-xl border flex items-start gap-4 ${adminPublicKey ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className={`mt-1 w-3 h-3 rounded-full ${adminPublicKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
            <div>
              <h3 className={`text-sm font-bold uppercase tracking-wide ${adminPublicKey ? 'text-emerald-800' : 'text-amber-800'}`}>System Status</h3>
              <p className={`text-sm ${adminPublicKey ? 'text-emerald-600' : 'text-amber-600'}`}>{status}</p>
              
              {/* This proves to the professor that the student is using the fetched key */}
              {adminPublicKey && (
                <div className="mt-3 text-xs font-mono text-emerald-700 break-all bg-emerald-100/50 p-2 rounded">
                  <strong>Fetched Public Key (y):</strong> {adminPublicKey}
                </div>
              )}
            </div>
            <button onClick={fetchPublicKey} className="ml-auto text-xs bg-white border px-3 py-1.5 rounded-md shadow-sm">Refresh Key</button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 text-zinc-300 p-4 rounded-xl text-sm font-mono mb-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <div className="text-emerald-400 font-bold mb-2">// Asymmetric Encryption Algorithms</div>
            <div><span className="text-zinc-500">Hint (c1)</span> = g^k mod p</div>
            <div><span className="text-zinc-500">Mask (c2)</span> = message * y^k mod p</div>
          </div>

          <label className="block text-sm font-semibold text-zinc-700 mb-2">Secure Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!adminPublicKey}
            className="w-full border border-zinc-300 p-4 rounded-xl h-40 bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none mb-5 resize-none transition-all disabled:opacity-50"
            
          />
          <button 
            onClick={handleEncryptSubmit}
            disabled={!adminPublicKey}
            className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white px-4 py-4 rounded-xl font-bold transition-all shadow-sm"
          >
            Encrypt using Server Key & Transmit
          </button>
        </section>
      </div>
    </div>
  );
}