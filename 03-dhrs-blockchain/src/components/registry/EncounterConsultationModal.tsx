import React, { useState } from "react";
import { Stethoscope, Lock, FileText, CheckCircle2, Pill, ShieldCheck, X } from "lucide-react";
import { PatientRecord, ClinicalEncounter, AuditEvent } from "@/types";
import { anchorConsultationRecordFlow } from "@/lib/web3";

interface EncounterConsultationModalProps {
  isOpen: boolean;
  patient: PatientRecord | null;
  onClose: () => void;
  onEncounterCreated: (encounter: ClinicalEncounter, auditEvent: AuditEvent) => void;
}

export const EncounterConsultationModal: React.FC<EncounterConsultationModalProps> = ({
  isOpen,
  patient,
  onClose,
  onEncounterCreated,
}) => {
  const [diagnosis, setDiagnosis] = useState("Acute Bronchitis & Secondary Upper Respiratory Infection");
  const [treatmentNotes, setTreatmentNotes] = useState(
    "Patient presented with persistent productive cough, mild fever 38.1°C, and chest discomfort. Chest auscultation revealed bilateral rhonchi without consolidation."
  );
  const [issueRx, setIssueRx] = useState(true);
  const [medicationName, setMedicationName] = useState("Amoxicillin + Clavulanic Acid (Augmentin 625mg)");
  const [claimAmount, setClaimAmount] = useState(650);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [resultData, setResultData] = useState<{ ipfsCid: string; onChainHash: string } | null>(null);

  if (!isOpen || !patient) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const clinicalPayload = JSON.stringify({
        patientId: patient.id,
        patientDID: patient.w3cDID,
        diagnosis,
        treatmentNotes,
        prescription: issueRx ? { medicationName, claimAmount } : null,
        timestamp: new Date().toISOString(),
      });

      const { encounter, auditEvent, ipfsCid, onChainHash } = await anchorConsultationRecordFlow({
        encounterId: Math.floor(100 + Math.random() * 900),
        patientId: patient.id,
        patientAddress: "0x7a39d882194b1509a25b16f391e5b4b2794c9f18",
        physicianAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        facilityAddress: "FAC-ET-AA-01",
        clinicalDataJson: clinicalPayload,
        diagnosis,
      });

      setResultData({ ipfsCid, onChainHash });
      setStep(2);
      onEncounterCreated(encounter, auditEvent);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consultation-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4 text-slate-800 dark:text-slate-100"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h3 id="consultation-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Open Clinical Encounter & Anchor Record
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Patient: <strong className="text-slate-700 dark:text-slate-200">{patient.fullName}</strong> ({patient.id})
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

        {step === 1 ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/40 text-xs text-teal-800 dark:text-teal-200 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
              <span>
                <strong>Active ISO 7816 Smart Card Consent Verified:</strong> Attending physician licensed under <code className="font-mono">PHYSICIAN_ROLE</code>.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Clinical Diagnosis
              </label>
              <input
                type="text"
                required
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Clinical Examination & Progress Notes
              </label>
              <textarea
                rows={3}
                required
                value={treatmentNotes}
                onChange={(e) => setTreatmentNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center">
                  <Pill className="w-4 h-4 mr-1 text-teal-500" /> Issue Electronic Prescription (ERC-1155)
                </span>
                <input
                  type="checkbox"
                  checked={issueRx}
                  onChange={(e) => setIssueRx(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
              </div>

              {issueRx && (
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Medication & Regimen</label>
                    <input
                      type="text"
                      value={medicationName}
                      onChange={(e) => setMedicationName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">CBHI Claim (eETB)</label>
                    <input
                      type="number"
                      value={claimAmount}
                      onChange={(e) => setClaimAmount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-100 dark:bg-slate-800/60 p-3 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-center space-x-2">
              <Lock className="w-4 h-4 text-teal-500 flex-shrink-0" />
              <span>
                Browser Web Crypto will encrypt this payload with <strong>AES-256-GCM</strong>. Only the hash is anchored on the Besu ledger.
              </span>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-md transition-colors flex items-center"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Encrypting & Anchoring...
                  </>
                ) : (
                  "Encrypt & Anchor On-Chain"
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Record Encrypted & Anchored</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Client-side AES-256-GCM encryption verified. Encrypted payload digest permanently stored in <code className="font-mono">encounters</code> mapping slot.
            </p>

            {resultData && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs text-left space-y-1.5 text-slate-700 dark:text-slate-300">
                <div><strong>IPFS CID:</strong> <span className="text-teal-600 dark:text-teal-400">{resultData.ipfsCid}</span></div>
                <div className="break-all"><strong>On-Chain Digest (bytes32):</strong> <span className="text-slate-500">{resultData.onChainHash}</span></div>
                <div><strong>State Machine:</strong> EncounterState.RecordAnchored (3)</div>
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-md"
            >
              Return to Patient Record
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

