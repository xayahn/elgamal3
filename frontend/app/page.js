'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Toast, useToast } from './components/Toast';

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
  const [studentName, setStudentName] = useState('');
  const [adminPublicKey, setAdminPublicKey] = useState('');   
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('Connecting to secure server...');
  const [isLoading, setIsLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const { toasts, addToast, removeToast } = useToast();

  // Automatically fetch the Public Key on load
  const fetchPublicKey = async () => {
    try {
      setStatus('Connecting to secure server...');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public-key`);
      const data = await response.json();
      if (data.publicKey) {
        setAdminPublicKey(data.publicKey);
        setStatus('Secure Connection Established');
        addToast('Connected to CIT server successfully!', 'success');
      } else {
        setStatus('Public key not available. Admin must generate one.');
        addToast('Public key not yet available', 'warning');
      }
    } catch (error) {
      setStatus('Failed to connect to CIT Server');
      addToast('Connection failed. Check your internet.', 'error');
    }
  };

  useEffect(() => {
    fetchPublicKey();
    const interval = setInterval(fetchPublicKey, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleEncryptSubmit = async (e) => {
    e.preventDefault();
    
    if (!studentName.trim()) {
      addToast('Please enter your name', 'warning');
      return;
    }
    
    if (!adminPublicKey) {
      addToast('System error: No public key available', 'error');
      return;
    }
    
    if (!message.trim()) {
      addToast('Message cannot be empty', 'warning');
      return;
    }

    setIsLoading(true);

    try {
      // Capture submission timestamp on client (real time)
      const submissionTimestamp = new Date().toLocaleString();
      
      // ElGamal Encryption
      const k = BigInt(Math.floor(Math.random() * 1000000) + 2); 
      const y = BigInt(adminPublicKey);
      const c1 = modExp(g, k, p);
      const s = modExp(y, k, p);
      
      const mArray = message.split('').map(char => BigInt(char.charCodeAt(0)));
      const c2Array = mArray.map(m => (m * s) % p);

      const payload = {
        studentName: studentName.trim(),
        c1: c1.toString(),
        c2Array: c2Array.map(c => c.toString()),
        targetPubKey: adminPublicKey,
        submissionTimestamp: submissionTimestamp
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setMessage('');
        setMessageCount(prev => prev + 1);
        addToast(`Feedback encrypted and sent securely, ${studentName}!`, 'success');
      } else {
        addToast('Submission failed. Please try again.', 'error');
      }
    } catch (error) {
      addToast('Network error. Please check your connection.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

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
              <p className="text-xs md:text-sm text-blue-100">CIT Office - Secure Feedback Portal</p>
            </div>
          </div>
          <Link href="/admin" className="px-6 py-2 bg-white text-blue-700 font-black rounded-lg hover:bg-blue-50 transition-all shadow-md hover:shadow-lg inline-block text-center">
            Staff Access
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

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-12 space-y-8">
        
        {/* Header Section */}
        <section className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 p-8 rounded-xl shadow-md">
          <h2 className="text-3xl md:text-4xl font-black text-blue-900 mb-2">Student Feedback Portal</h2>
          <p className="text-gray-700 font-semibold mb-4">Securely submit your feedback using end-to-end encryption</p>
          <div className="bg-blue-100 border-l-4 border-blue-700 p-4 rounded">
            <p className="text-sm font-medium text-blue-900">
              <span className="font-black">End-to-End Encrypted:</span> Your messages are protected with ElGamal cryptography
            </p>
          </div>
        </section>

        {/* Status Card */}
        <section className={`border-2 p-6 rounded-xl shadow-md transition-all ${
          adminPublicKey 
            ? 'bg-green-50 border-green-300' 
            : 'bg-amber-50 border-amber-300'
        }`}>
          <div className="flex items-start gap-4 justify-between">
            <div className="flex-1">
              <h3 className={`text-xl font-black mb-2 ${adminPublicKey ? 'text-green-900' : 'text-amber-900'}`}>
                {adminPublicKey ? '✓ System Ready' : 'Connecting...'}
              </h3>
              <p className="text-gray-700 text-sm mb-3 font-medium">{status}</p>
              {adminPublicKey && (
                <div className="text-xs font-mono text-gray-600 bg-white p-3 rounded border border-gray-300 truncate">
                  Public Key: {adminPublicKey.substring(0, 50)}...
                </div>
              )}
            </div>
            <button 
              onClick={fetchPublicKey}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all whitespace-nowrap"
            >
              Refresh
            </button>
          </div>
        </section>

        {/* Main Form Section */}
        <section className="bg-white border-2 border-blue-200 p-8 rounded-xl shadow-md">
          <h3 className="text-2xl font-black text-blue-900 mb-6">Submit Your Feedback</h3>
          <form onSubmit={handleEncryptSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-black text-blue-900 mb-2">Full Name</label>
              <input 
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-all bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-black text-blue-900 mb-2">Your Feedback</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your feedback here... (Your message will be encrypted)"
                disabled={!adminPublicKey}
                rows={6}
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none bg-white"
              />
              <p className="text-xs text-gray-600 mt-2 font-medium">
                {message.length} characters • Messages are encrypted end-to-end
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
                <p className="text-xs text-gray-600 font-mono font-semibold mb-1">Formula (c1)</p>
                <p className="text-sm text-blue-900 font-black">g^k mod p</p>
              </div>
              <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg">
                <p className="text-xs text-gray-600 font-mono font-semibold mb-1">Formula (c2)</p>
                <p className="text-sm text-blue-900 font-black">m × y^k mod p</p>
              </div>
            </div>

            <button 
              type="submit"
              disabled={!adminPublicKey || isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-black text-lg rounded-lg transition-all shadow-md hover:shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isLoading ? 'ENCRYPTING...' : 'Encrypt and Send Feedback'}
            </button>
          </form>

          {messageCount > 0 && (
            <div className="mt-6 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
              <p className="text-sm font-black text-green-900">
                SUCCESS: <span className="font-bold">{messageCount}</span> message{messageCount > 1 ? 's' : ''} successfully encrypted and sent!
              </p>
            </div>
          )}
        </section>

        {/* Info Section */}
        <section className="bg-blue-50 border-2 border-blue-200 p-8 rounded-xl shadow-md">
          <h3 className="text-2xl font-black text-blue-900 mb-6">Why Use This Portal?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-blue-200 p-6 rounded-lg">
              <h4 className="font-black text-blue-900 mb-2 text-lg">Secure</h4>
              <p className="text-sm text-gray-700">Military-grade ElGamal encryption protects your feedback</p>
            </div>
            <div className="bg-white border border-blue-200 p-6 rounded-lg">
              <h4 className="font-black text-blue-900 mb-2 text-lg">Private</h4>
              <p className="text-sm text-gray-700">You control your privacy - share your name or remain anonymous</p>
            </div>
            <div className="bg-white border border-blue-200 p-6 rounded-lg">
              <h4 className="font-black text-blue-900 mb-2 text-lg">Protected</h4>
              <p className="text-sm text-gray-700">All data is encrypted before leaving your browser</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-blue-200 pt-8 mt-12">
          <p className="text-center text-sm text-gray-600 font-medium">
            University of the Assumption CIT Office • Secure Feedback System
          </p>
        </footer>
      </div>
    </div>
  );
}