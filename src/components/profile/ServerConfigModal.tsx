import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { X, Server, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { syncRemoteConfig } from '../../services/apiConfig';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ServerConfigModal({ isOpen, onClose }: ServerConfigModalProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('grezto_backend_url') || '';
      setServerUrl(saved);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async (testUrl: string) => {
    const target = testUrl.trim();
    if (!target) {
      toast.error("Please enter a valid URL first! 🛑");
      return;
    }

    setTesting(true);
    setTestResult(null);
    const loadingToast = toast.loading("Checking server connection... ⚡");

    try {
      // Append /api/health to verify if the server is up and responsive
      const healthPath = target.endsWith('/') ? `${target}api/health` : `${target}/api/health`;
      console.log(`[Developer Sync] Testing connection to health path: ${healthPath}`);
      
      const res = await window.fetch(healthPath, {
        method: 'GET',
        headers: {
          'X-Grezto-Client-Signature': "grezto_secure_app_signature_2026_unicorn"
        }
      });

      toast.dismiss(loadingToast);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestResult({
          success: true,
          message: `Connected successfully! Status: ${data.status || 'OK'}`
        });
        toast.success("Server connected successfully! ✅");
      } else {
        setTestResult({
          success: false,
          message: `Server returned status error: ${res.status}`
        });
        toast.error(`Server error: ${res.status} 🛑`);
      }
    } catch (err: any) {
      toast.dismiss(loadingToast);
      setTestResult({
        success: false,
        message: `Network error: ${err.message || 'Connection refused'}`
      });
      toast.error("Failed to connect to the server. ❌");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndSync = async () => {
    const trimmedUrl = serverUrl.trim();
    
    // Set item
    if (trimmedUrl) {
      localStorage.setItem('grezto_backend_url', trimmedUrl);
    } else {
      localStorage.removeItem('grezto_backend_url');
    }

    const syncToast = toast.loading("Synchronizing remote database keys... 🚀");
    const syncSuccess = await syncRemoteConfig();
    toast.dismiss(syncToast);

    if (syncSuccess) {
      toast.success("Server perfect connect and sync ho gaya hai! Makkhan ki tarah chalega! ✨🍰", {
        duration: 3000
      });
      onClose();
      // Reload the page to apply new Supabase connection context globally instantly!
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      toast.error("Sync failed! Server url correct hai par remote keys retrieve nahi ho saki. 🛑");
    }
  };

  const handleReset = () => {
    setServerUrl('');
    setTestResult(null);
    toast.success("URL reset to system default! 🔄");
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0 sm:p-5">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black backdrop-blur-xs"
      />
      <motion.div 
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 relative z-[100001] shadow-2xl border border-amber-100 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center space-x-2 text-amber-600">
            <Server size={20} className="stroke-[2.5]" />
            <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Server Sync Settings</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-gray-50 rounded-xl hover:bg-gray-100 border-0 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 text-[10.5px] font-bold text-amber-800 leading-relaxed">
            💡 <span className="font-extrabold uppercase">Android Device Par Testing Guide:</span>
            <br />
            Real phone par test karte waqt default <code className="bg-amber-100 px-1 rounded text-red-600 font-mono text-[9px]">10.0.2.2:3000</code> work nahi karega. 
            Apne AI Studio ka Active Preview URL copy kijiye (jaise <code className="bg-amber-100 px-1 rounded text-red-600 font-mono text-[9px]">https://ais-pre-...run.app</code>) aur niche paste kijiye!
          </div>

          <div>
            <label className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider block mb-1.5">
              Backend Server URL
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="https://ais-pre-your-url.run.app"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="w-full bg-gray-50 text-slate-800 p-3.5 pr-10 rounded-2xl border border-gray-250/50 text-[11px] font-semibold focus:outline-none focus:border-amber-500 focus:bg-white transition-all font-mono"
              />
              {serverUrl && (
                <button
                  onClick={() => setServerUrl('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-450 hover:text-gray-700 border-0 bg-transparent cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {testResult && (
            <div className={`p-4 rounded-2xl flex items-start gap-2.5 border text-[11px] font-bold leading-relaxed ${
              testResult.success 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-rose-50 border-rose-100 text-rose-850'
            }`}>
              {testResult.success ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-extrabold uppercase text-[9px] tracking-wider mb-0.5">
                  {testResult.success ? "Connection Success" : "Connection Failure"}
                </p>
                <p>{testResult.message}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5 pt-1">
            <button
              type="button"
              disabled={testing || !serverUrl.trim()}
              onClick={() => handleTestConnection(serverUrl)}
              className="bg-gray-50 hover:bg-gray-100 disabled:opacity-40 text-slate-800 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border border-gray-200 transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Test Connection"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="bg-gray-50 hover:bg-gray-100 text-slate-500 py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest border border-gray-200 transition-colors cursor-pointer"
            >
              Reset to Default
            </button>
          </div>

          <div className="pt-3">
            <button
              type="button"
              disabled={testing}
              onClick={handleSaveAndSync}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border-0 transition-all cursor-pointer shadow-lg shadow-amber-600/15"
            >
              Save & Synchronize Keys 🚀
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
