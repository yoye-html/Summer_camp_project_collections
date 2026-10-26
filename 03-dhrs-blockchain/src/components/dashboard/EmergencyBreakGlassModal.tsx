import React, { useState } from "react";
import { AlertOctagon, ShieldAlert, CheckCircle, Clock, X } from "lucide-react";
import { AuditEvent } from "@/types";

interface EmergencyBreakGlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (event: AuditEvent) => void;
}

export const EmergencyBreakGlassModal: React.FC<EmergencyBreakGlassModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [patientId, setPatientId] = useState("ET-DID-TRAUMA-99");
  const [justification, setJustification] = useState(
    "Unconscious roadside trauma patient admitted to Emergency Ward with critical intracranial hemorrhage and unreadable biometric card."
  );
  const [primaryDoctor, setPrimaryDoctor] = useState("Dr. Almaz Mengistu (Chief ER Surgeon)");
  const [secondaryDoctor, setSecondaryDoctor] = useState("Dr. Henok Bekele (Attending Traumatologist)");
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleExecuteBreakGlass = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const auditEvent: AuditEvent = {
        id: `EVT-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        eventType: "EMERGENCY_BREAK_GLASS",
        recordReference: patientId,
        actorAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e & 0x892a0149a5f19277fc31a76a59f12b32525f34e2",
        actorRole: "2 Licensed Physicians (2-of-3 Multi-Sig Consensus)",
        facility: "Tikur Anbessa Specialized Hospital (ER Ward)",
        verificationStatus: "Confirmed on Ledger",
        txHash: "0x" + Array.from(window.crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join(""),
        blockNumber: 4892015,
        details: `EMERGENCY BREAK-GLASS EXECUTED: 2-of-3 physicians co-signed for ${patientId}. Strict 24-hour time lock granted. Justification: ${justification.slice(0, 80)}...`,
        integrityProofValid: true,
      };

      onSuccess(auditEvent);
      onClose();
    }, 1200);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 p-6 shadow-2xl text-slate-800 dark:text-slate-100">
        <div className="flex items-start justify-between pb-4 border-b border-red-100 dark:border-red-900/30">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 id="emergency-title" className="text-lg font-bold text-red-600 dark:text-red-400">
                2-of-3 Multi-Sig Emergency Break-Glass Protocol
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solidity Contract: <code className="font-mono text-teal-600 dark:text-teal-400">DHRSCoreUpgradeable.sol</code> (Phase III, Project 9)
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

        <div className="my-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl p-3.5 text-xs text-red-700 dark:text-red-300 flex items-start space-x-2.5">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <p>
            <strong>Legal & Ministerial Notice:</strong> This protocol bypasses standard biometric consent for unconscious or displaced trauma victims. Requires <strong>2 independent licensed physicians</strong> holding <code className="font-mono">PHYSICIAN_ROLE</code>. An indelible audit event is written to the blockchain.
          </p>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Target Patient Identifier / DID
              </label>
              <input
                type="text"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Clinical Emergency Justification
              </label>
              <textarea
                rows={3}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="block text-xs text-slate-500 dark:text-slate-400 font-medium">Physician #1 (Initiator)</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{primaryDoctor}</span>
                <span className="mt-1 flex items-center text-xs text-teal-600 dark:text-teal-400">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approved
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="block text-xs text-slate-500 dark:text-slate-400 font-medium">Physician #2 (Co-Signer)</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{secondaryDoctor}</span>
                <span className="mt-1 flex items-center text-xs text-amber-600 dark:text-amber-400">
                  <Clock className="w-3.5 h-3.5 mr-1" /> Pending Co-Signature
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-md transition-colors"
              >
                Proceed to Multi-Sig Co-Sign
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-200">
              <h4 className="font-semibold text-sm mb-1 text-amber-900 dark:text-amber-100">Co-Signing Verification</h4>
              <p>
                Confirming execution will immediately trigger <code className="font-mono">approveEmergencyBreakGlass()</code> in the smart contract, granting strictly <strong>24-hour read/write access</strong> to the attending physicians.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono space-y-1">
              <div><strong>Target Patient:</strong> {patientId}</div>
              <div><strong>Co-Signer 1:</strong> 0x742d35Cc6634C0532925a3b844Bc454e4438f44e (Dr. Almaz)</div>
              <div><strong>Co-Signer 2:</strong> 0x892a0149a5f19277fc31a76a59f12b32525f34e2 (Dr. Henok)</div>
              <div><strong>Expiration Window:</strong> block.timestamp + 86400 (24h)</div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Back to details
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleExecuteBreakGlass}
                  className="px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-md transition-colors flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Broadcasting Multi-Sig...
                    </>
                  ) : (
                    "Authorize & Anchor Break-Glass"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

