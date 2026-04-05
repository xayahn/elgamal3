'use client';
import { useEffect, useState } from 'react';

export function Toast({ message, type = 'success', duration = 5000, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  };

  const iconColors = {
    success: 'text-emerald-600',
    error: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
  };

  const icons = {
    success: 'OK',
    error: 'ERROR',
    warning: 'WARN',
    info: 'INFO',
  };

  return (
    <div className={`fixed top-4 right-4 max-w-sm px-6 py-4 rounded-xl border ${bgColors[type]} shadow-lg animate-slideIn z-50`}>
      <div className="flex items-center gap-3">
        <span className={`text-lg font-black ${iconColors[type]}`}>{icons[type]}</span>
        <p className={`text-sm font-bold ${iconColors[type]}`}>{message}</p>
      </div>
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success', duration = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, addToast, removeToast };
}
