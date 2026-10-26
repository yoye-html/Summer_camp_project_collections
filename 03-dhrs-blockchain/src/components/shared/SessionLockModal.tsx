import React, { useState } from "react";
import { Lock, ShieldCheck, KeyRound } from "lucide-react";

interface SessionLockModalProps {
  isLocked: boolean;
  onUnlock: () => void;
  userRole: string;
}

export const SessionLockModal: React.FC<SessionLockModalProps> = ({
  isLocked,
  onUnlock,
  userRole,
}) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  if (!isLocked) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo PIN: "1234" or any non-empty PIN for quick testing
    if (pin === "1234" || pin.length >= 4) {
      setError(false);
      setPin("");
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/90 backdrop-blur-md p-4 text-slate-100"
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-teal-400" aria-hidden="true" />
        </div>

        <h2 id="lock-title" className="text-2xl font-bold tracking-tight text-white mb-2">
          Clinical Session Locked
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          To protect patient confidentiality and comply with Ethiopian Health Data Regulations, this terminal has been locked.
        </p>

        <div className="bg-slate-800/60 rounded-xl p-3 mb-6 flex items-center justify-center space-x-2 text-xs text-slate-300 border border-slate-700/50">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>Active Role: <strong className="capitalize text-teal-300">{userRole.replace("_", " ")}</strong></span>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="text-left">
            <label htmlFor="unlock-pin" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Enter 4-Digit Security PIN (Default: 1234)
            </label>
            <div className="relative">
              <input
                id="unlock-pin"
                type="password"
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(false);
                }}
                autoFocus
                placeholder="••••"
                className={`w-full text-center tracking-widest text-xl py-3 px-4 rounded-lg bg-slate-950 border ${
                  error ? "border-red-500 ring-1 ring-red-500" : "border-slate-700 focus:border-teal-500"
                } text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20`}
              />
              <KeyRound className="absolute right-3.5 top-3.5 w-5 h-5 text-slate-500" />
            </div>
            {error && (
              <p className="text-xs text-red-400 mt-1.5 text-center">
                Invalid PIN. Enter 1234 to resume clinical session.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg shadow-lg shadow-teal-900/40 transition-colors focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Unlock Session
          </button>
        </form>
      </div>
    </div>
  );
};

