'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Toast, useToast } from '../components/Toast';

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
  const [isHydrated, setIsHydrated] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Key Management States
  const [privateKeyGen, setPrivateKeyGen] = useState('');
  const [auditLog, setAuditLog] = useState(null);
  const [activeServerKey, setActiveServerKey] = useState('');
  const [keyPublishLoading, setKeyPublishLoading] = useState(false);

  // Decryption States
  const [storedFeedbacks, setStoredFeedbacks] = useState([]);
  const [decryptKey, setDecryptKey] = useState(''); 
  const [decryptedResults, setDecryptedResults] = useState({});
  const [expandedFeedback, setExpandedFeedback] = useState(null);
  const { toasts, addToast, removeToast } = useToast();

  // Check localStorage after hydration
  useEffect(() => {
    const storedLoginState = localStorage.getItem('adminLoggedIn') === 'true';
    const storedToken = localStorage.getItem('adminToken');
    if (storedLoginState && storedToken) {
      setIsAdminLoggedIn(true);
      setAdminToken(storedToken);
    }
    setIsHydrated(true);
  }, []);

  const fetchData = async () => {
    try {
      const [fbRes, pkRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public-key`)
      ]);
      setStoredFeedbacks(await fbRes.json());
      const pkData = await pkRes.json();
      setActiveServerKey(pkData.publicKey);
    } catch (error) {
      addToast('Failed to fetch data', 'error');
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [isAdminLoggedIn]);

  const handlePublishKeys = async () => {
    if (!privateKeyGen || isNaN(privateKeyGen)) {
      addToast('Enter a valid numeric private key', 'warning');
      return;
    }
    const x = BigInt(privateKeyGen);
    if (x <= 1n || x >= p - 1n) {
      addToast('Private key must be between 1 and p-1', 'warning');
      return;
    }
    
    const y = modExp(g, x, p);
    setKeyPublishLoading(true);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public-key`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ publicKey: y.toString() })
      });

      if (response.ok) {
        setActiveServerKey(y.toString());
        setAuditLog({ prime: p.toString(), generator: g.toString(), privateX: x.toString(), publicY: y.toString() });
        addToast('Public key successfully published!', 'success');
        setPrivateKeyGen('');
      }
    } catch (e) {
      addToast('Failed to publish key', 'error');
    } finally {
      setKeyPublishLoading(false);
    }
  };

  const handleDecrypt = async (feedbackId) => {
    if (!decryptKey || isNaN(decryptKey)) {
      addToast('Enter a valid decryption key', 'warning');
      return;
    }
    const feedback = storedFeedbacks.find(f => f.id === feedbackId);
    if (!feedback) return;

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
      const decryptedMessage = decryptedChars.join('');
      
      // Check if decryption was successful (has valid characters)
      if (!decryptedMessage || decryptedMessage.trim().length === 0) {
        addToast('Incorrect private key - unable to decrypt message', 'error');
        setDecryptedResults({ ...decryptedResults, [feedbackId]: "Invalid private key" });
        return;
      }
      
      setDecryptedResults({ ...decryptedResults, [feedbackId]: decryptedMessage });
      
      // Record the private key used
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback/${feedbackId}/decrypt-history`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({ privateKey: decryptKey })
        });
      } catch (e) {
        // History endpoint optional
      }
      
      addToast(`Message from ${feedback.studentName} decrypted successfully`, 'success');
    } catch (e) {
      addToast('Incorrect private key - decryption failed', 'error');
      setDecryptedResults({ ...decryptedResults, [feedbackId]: "Decryption failed - invalid key" });
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    if (!username.trim() || !password.trim()) {
      setLoginError('Username and password required');
      setIsLoggingIn(false);
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const data = await response.json();
      if (data.success && data.token) {
        setIsAdminLoggedIn(true);
        setAdminToken(data.token);
        localStorage.setItem('adminLoggedIn', 'true');
        localStorage.setItem('adminToken', data.token);
        setUsername('');
        setPassword('');
        addToast('Login successful', 'success');
      } else {
        setLoginError(data.error || 'Invalid credentials');
        addToast('Invalid credentials', 'error');
      }
    } catch (error) {
      setLoginError('Connection failed');
      addToast('Check if backend is running', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Don't render until hydration is complete to avoid mismatch
  if (!isHydrated) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Navigation Bar */}
        <nav className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex items-center gap-3">
              <Image 
                src="/ualogo.png" 
                alt="University of the Assumption" 
                width={50} 
                height={50}
                className="rounded-full"
              />
              <div>
                <h1 className="text-xl md:text-2xl font-black">University of the Assumption</h1>
                <p className="text-xs md:text-sm text-blue-100">CIT Office - Staff Access</p>
              </div>
            </div>
            <Link href="/" className="px-6 py-2 bg-white text-blue-700 font-black rounded-lg hover:bg-blue-50 transition-all shadow-md hover:shadow-lg inline-block text-center">
              Back to Portal
            </Link>
          </div>
        </nav>

        {/* Toast Notifications */}
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}

        {/* Login Form Container */}
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 rounded-xl shadow-lg p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-blue-900 mb-2">Staff Access</h2>
                <p className="text-gray-700 font-medium">Secure Admin Portal for CIT Office</p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-black text-blue-900 mb-2">Username</label>
                  <input 
                    type="text" 
                    value={username} 
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setLoginError('');
                    }}
                    disabled={isLoggingIn}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50 bg-white font-medium"
                    placeholder="Enter your username"
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-black text-blue-900 mb-2">Password</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setLoginError('');
                    }}
                    disabled={isLoggingIn}
                    className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50 bg-white font-medium"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </div>

                {loginError && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                    <p className="text-sm text-red-900 font-black">{loginError}</p>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-black text-lg rounded-lg transition-all shadow-md hover:shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? 'AUTHENTICATING...' : 'Sign In to Dashboard'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t-2 border-blue-200 text-center">
                <p className="text-xs text-gray-600 font-medium">
                  For authorized staff only
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-gray-100 border-t-2 border-blue-200 py-4 px-4">
          <p className="text-center text-sm text-gray-600 font-medium">
            University of the Assumption CIT Office
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Navigation Bar */}
      <nav className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Image 
              src="/ualogo.png" 
              alt="University of the Assumption" 
              width={50} 
              height={50}
              className="rounded-full"
            />
            <div>
              <h1 className="text-xl md:text-2xl font-black">University of the Assumption</h1>
              <p className="text-xs md:text-sm text-blue-100">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/" className="px-6 py-2 bg-white text-blue-700 font-black rounded-lg hover:bg-blue-50 transition-all shadow-md hover:shadow-lg inline-block text-center">
              Student Portal
            </Link>
            <button 
              onClick={() => {
                setIsAdminLoggedIn(false);
                setAdminToken('');
                localStorage.removeItem('adminLoggedIn');
                localStorage.removeItem('adminToken');
              }} 
              className="px-6 py-2 bg-red-500 text-white font-black rounded-lg hover:bg-red-600 transition-all shadow-md hover:shadow-lg"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Toast Notifications */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 space-y-8">
        
        {/* Header Section */}
        <section className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 p-8 rounded-xl shadow-md">
          <h2 className="text-3xl md:text-4xl font-black text-blue-900 mb-2">Admin Dashboard</h2>
          <p className="text-gray-700 font-semibold">Manage ElGamal keys and decrypt student feedback</p>
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Section 1: Key Generation */}
          <section className="bg-white border-2 border-blue-200 p-8 rounded-xl shadow-md">
            <h2 className="text-2xl font-black text-blue-900 mb-6">
              KEY GENERATION
            </h2>
            
            <div className="bg-blue-50 border-2 border-blue-200 text-gray-700 p-6 rounded-lg text-sm font-mono mb-6">
              <div className="mb-4 pb-4 border-b-2 border-blue-300">
                <span className="text-blue-900 font-black">Formula:</span> <span className="text-gray-700 font-semibold">y = g^x mod p</span>
              </div>
              <div className="space-y-2 text-xs font-semibold">
                <p><span className="text-gray-600">Prime (p):</span> <span className="text-blue-900 font-black">{p.toString()}</span></p>
                <p><span className="text-gray-600">Generator (g):</span> <span className="text-blue-900 font-black">{g.toString()}</span></p>
              </div>
            </div>

            <label className="block text-sm font-black text-blue-900 mb-2">Master Private Key (x)</label>
            <input 
              type="number" 
              value={privateKeyGen} 
              onChange={(e) => setPrivateKeyGen(e.target.value)}
              className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 mb-4 transition-all bg-white font-medium"
              placeholder="e.g., 8051"
            />
            <button 
              onClick={handlePublishKeys}
              disabled={keyPublishLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-black rounded-lg transition-all shadow-md hover:shadow-lg mb-6"
            >
              {keyPublishLoading ? 'PUBLISHING...' : 'GENERATE AND PUBLISH KEY'}
            </button>

            {auditLog && (
              <div className="bg-green-50 border-2 border-green-300 p-6 rounded-lg">
                <h3 className="font-black text-green-900 mb-4 uppercase tracking-wider text-sm">AUDIT LOG</h3>
                <div className="space-y-3 text-xs font-mono font-bold text-gray-700">
                  <div><span className="text-gray-600">Prime (p):</span> <span className="text-green-900 break-all">{auditLog.prime}</span></div>
                  <div><span className="text-gray-600">Generator (g):</span> <span className="text-green-900">{auditLog.generator}</span></div>
                  <div><span className="text-gray-600">Private Key (x):</span> <span className="text-green-900">{auditLog.privateX}</span></div>
                  <div className="border-t-2 border-green-300 pt-3 mt-3"><span className="text-gray-600">Public Key (y):</span> <span className="text-green-900 break-all">{auditLog.publicY.substring(0, 50)}...</span></div>
                </div>
              </div>
            )}
          </section>

          {/* Section 2: Decryption Dashboard */}
          <section className="bg-white border-2 border-blue-200 p-8 rounded-xl shadow-md flex flex-col">
            <h2 className="text-2xl font-black text-blue-900 mb-6">
              DECRYPTION
            </h2>

            <div className="bg-blue-50 border-2 border-blue-200 text-gray-700 p-6 rounded-lg text-sm font-mono mb-6">
              <span className="text-blue-900 font-black">Formula:</span> <span className="text-gray-700 font-semibold">m = c2 × (c1^x)^-1 mod p</span>
            </div>

            <label className="block text-sm font-black text-blue-900 mb-2">Private Key (x)</label>
            <input 
              type="number" 
              value={decryptKey} 
              onChange={(e) => setDecryptKey(e.target.value)}
              className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 mb-6 transition-all bg-white font-medium"
              placeholder="Enter private key to decrypt messages"
            />

            <div className="flex-1 overflow-auto space-y-3">
              {storedFeedbacks.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-700 text-center font-semibold">
                    No messages yet. Students will send feedback here.
                  </p>
                </div>
              ) : (
                storedFeedbacks.map((fb, idx) => (
                  <div 
                    key={fb.id}
                    onClick={() => setExpandedFeedback(expandedFeedback === fb.id ? null : fb.id)}
                    className="bg-white border-2 border-blue-200 p-4 rounded-lg hover:border-blue-400 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-black text-blue-900 text-sm">{fb.studentName || 'Anonymous'}</p>
                        <p className="text-xs text-gray-600 mt-1">{fb.timestamp}</p>
                      </div>
                      <span className="bg-blue-200 text-blue-900 px-3 py-1 rounded-lg text-xs font-black">#{idx + 1}</span>
                    </div>

                    {expandedFeedback === fb.id && (
                      <div className="space-y-3 border-t-2 border-blue-200 pt-3">
                        <button 
                          onClick={() => handleDecrypt(fb.id)}
                          className="w-full py-2 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white font-black rounded-lg text-sm transition-all"
                        >
                          DECRYPT MESSAGE
                        </button>

                        {decryptedResults[fb.id] && (
                          <div className={`p-3 rounded-lg text-sm border-2 ${
                            decryptedResults[fb.id].includes('failed') || decryptedResults[fb.id].includes('Decryption failed')
                              ? 'bg-red-50 border-red-300 text-red-900' 
                              : 'bg-green-50 border-green-300 text-green-900'
                          }`}>
                            <p className="text-xs font-black mb-1">DECRYPTED MESSAGE:</p>
                            <p className="break-words font-semibold">{decryptedResults[fb.id]}</p>
                            <p className="text-xs mt-2 opacity-75 font-medium">Private key used: {decryptKey}</p>
                          </div>
                        )}

                        <div className="bg-gray-100 p-3 rounded-lg border-2 border-gray-300">
                          <p className="text-xs text-gray-700 mb-2 font-black">Encrypted Data (c1, c2):</p>
                          <p className="text-xs font-mono text-gray-600 truncate font-bold">c1: {fb.c1.substring(0, 30)}...</p>
                          <p className="text-xs font-mono text-gray-600 truncate font-bold">c2: [{fb.c2Array[0]}, {fb.c2Array[1]}, ...]</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="bg-gray-100 border-t-2 border-blue-200 py-4 px-4 rounded-lg">
          <p className="text-center text-sm text-gray-700 font-medium">
            University of the Assumption CIT Office
          </p>
        </footer>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        :global(.animate-slideIn) {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}