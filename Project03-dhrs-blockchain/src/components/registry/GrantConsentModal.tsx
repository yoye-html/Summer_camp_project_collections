import React, { useState, useMemo } from "react";
import { KeyRound, ShieldCheck, Clock, CheckCircle2, CreditCard, Wallet, X, Sliders } from "lucide-react";
import { PatientRecord, AuditEvent } from "@/types";

interface GrantConsentModalProps {
  isOpen: boolean;
  patient: PatientRecord | null;
  onClose: () => void;
  onConsentGranted: (auditEvent: AuditEvent) => void;
  walletAccount: string | null;
}

type DurationUnit = "hours" | "days" | "weeks";

export const GrantConsentModal: React.FC<GrantConsentModalProps> = ({
  isOpen,
  patient,
  onClose,
  onConsentGranted,
  walletAccount,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<number | "custom">(24);
  const [customValue, setCustomValue] = useState<number>(24);
  const [customUnit, setCustomUnit] = useState<DurationUnit>("hours");
  const [selectedDoctor, setSelectedDoctor] = useState("0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
  const [authMethod, setAuthMethod] = useState<"smartcard" | "metamask">("smartcard");
  const [isSigning, setIsSigning] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !patient) return null;

  // Calculate total seconds and hours
  const totalSeconds = useMemo(() => {
    if (selectedPreset !== "custom") {
      return selectedPreset * 3600;
    }
    const multiplier = customUnit === "hours" ? 3600 : customUnit === "days" ? 86400 : 604800;
    return Math.max(1, customValue) * multiplier;
  }, [selectedPreset, customValue, customUnit]);

  const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;

  // Calculate human-readable expiration time
  const expirationDate = useMemo(() => {
    const d = new Date(Date.now() + totalSeconds * 1000);
    return d.toLocaleString("en-US", {
      timeZone: "Africa/Addis_Ababa",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + " EAT";
  }, [totalSeconds]);

  const handleGrantConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalSeconds <= 0) return;
    setIsSigning(true);

    setTimeout(() => {
      setIsSigning(false);
      setSuccess(true);

      const auditEvent: AuditEvent = {
        id: `EVT-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        eventType: "CONSENT_GRANTED",
        recordReference: patient.id,
        actorAddress: patient.w3cDID.slice(12),
        actorRole: "Citizen / Patient Sovereign Identity",
        facility: "Tikur Anbessa Specialized Hospital",
        verificationStatus: "Confirmed on Ledger",
        txHash: "0x" + Array.from(window.crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join(""),
        blockNumber: 4892020,
        details: `Custom Consent Ticket anchored on-chain for physician ${selectedDoctor.slice(0, 10)}... Duration: ${totalHours}h (${totalSeconds.toLocaleString()}s). Valid until: ${expirationDate}. Method: ${authMethod === "smartcard" ? "ISO 7816 Biometric Card Tap" : "MetaMask Secp256k1 Signature"}.`,
        integrityProofValid: true,
      };

      onConsentGranted(auditEvent);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1300);
    }, 1000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4 text-slate-800 dark:text-slate-100"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 id="consent-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Grant Time-Locked Medical Consent
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solidity: <code className="font-mono text-teal-600">grantConsent(physician, durationSeconds)</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Consent Ticket Anchored on Ledger</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Cryptographic authorization granted for <strong>{totalHours} hours</strong>.
            </p>
            <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono text-teal-600 dark:text-teal-400">
              Expires: {expirationDate}
            </div>
          </div>
        ) : (
          <form onSubmit={handleGrantConsent} className="space-y-4 my-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
              <div><strong>Patient:</strong> {patient.fullName} ({patient.id})</div>
              <div><strong>Soulbound DID:</strong> <span className="font-mono text-[11px] text-teal-600 dark:text-teal-400">{patient.w3cDID}</span></div>
            </div>

            {/* Authentication Gateway Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Citizen Signature Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAuthMethod("smartcard")}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-colors ${
                    authMethod === "smartcard"
                      ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <CreditCard className="w-5 h-5 mb-2 text-teal-600" />
                  <span className="font-bold text-xs">ISO 7816 Smart Card</span>
                  <span className="text-[10px] text-slate-500">Biometric NFC / Card Terminal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMethod("metamask")}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-colors ${
                    authMethod === "metamask"
                      ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <Wallet className="w-5 h-5 mb-2 text-teal-600" />
                  <span className="font-bold text-xs">MetaMask / Web3 Wallet</span>
                  <span className="text-[10px] text-slate-500">EVM Secp256k1 Signature</span>
                </button>
              </div>
            </div>

            {/* Target Physician Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Authorize Licensed Physician
              </label>
              <select
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none text-slate-800 dark:text-slate-200"
              >
                <option value="0x742d35Cc6634C0532925a3b844Bc454e4438f44e">
                  Dr. Almaz Mengistu (Tikur Anbessa Hospital • PHYSICIAN_ROLE)
                </option>
                <option value="0x892a0149a5f19277fc31a76a59f12b32525f34e2">
                  Dr. Henok Bekele (Jimma University Medical Center • PHYSICIAN_ROLE)
                </option>
              </select>
            </div>

            {/* Configurable / Custom Expiration Duration */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Consent Expiry Duration
                </label>
                <span className="text-[11px] font-mono text-teal-600 dark:text-teal-400 font-semibold">
                  Total: {totalHours}h ({totalSeconds.toLocaleString()}s)
                </span>
              </div>

              {/* Presets Row */}
              <div className="grid grid-cols-4 gap-2 mb-2.5">
                {[
                  { value: 1, label: "1 Hour" },
                  { value: 24, label: "24 Hours (ER)" },
                  { value: 72, label: "3 Days" },
                  { value: "custom", label: "Custom ⚙️" },
                ].map((item) => (
                  <button
                    key={String(item.value)}
                    type="button"
                    onClick={() => {
                      if (item.value === "custom") {
                        setSelectedPreset("custom");
                      } else {
                        setSelectedPreset(item.value as number);
                      }
                    }}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg border text-center transition-colors ${
                      selectedPreset === item.value
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 shadow-xs"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom Input Fields (Active when Custom is selected) */}
              {selectedPreset === "custom" && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Set Custom Time-Lock Window
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                        Amount
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={customValue}
                        onChange={(e) => setCustomValue(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                        Unit
                      </label>
                      <select
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value as DurationUnit)}
                        className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none"
                      >
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Real-Time Live Expiration Display */}
            <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/40 text-[11px] text-teal-900 dark:text-teal-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center font-bold">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                  Exact Expiration Timestamp:
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px]">
                  block.timestamp + {totalSeconds}s
                </span>
              </div>
              <p className="font-semibold text-teal-800 dark:text-teal-300 pl-5">
                {expirationDate}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-5">
                Enforced by Solidity: if a transaction arrives after this second, the EVM automatically triggers <code className="font-mono">ConsentExpired()</code>.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSigning}
                className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-md transition-colors flex items-center"
              >
                {isSigning ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Broadcasting Consent...
                  </>
                ) : (
                  authMethod === "smartcard" ? "Simulate ISO 7816 Card Tap" : "Sign with MetaMask"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
