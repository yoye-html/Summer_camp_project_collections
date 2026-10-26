import React, { useState } from "react";
import {
  X,
  User,
  Activity,
  Calendar,
  Pill,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Key,
  Stethoscope,
  ExternalLink,
} from "lucide-react";
import { PatientRecord, UserRole } from "@/types";
import { StatusBadge } from "../shared/StatusBadge";
import { hasPermission } from "@/lib/permissions";

interface PatientDetailDrawerProps {
  patient: PatientRecord | null;
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  onOpenConsultation: () => void;
  onOpenGrantConsent?: () => void;
}

export const PatientDetailDrawer: React.FC<PatientDetailDrawerProps> = ({
  patient,
  isOpen,
  onClose,
  userRole,
  onOpenConsultation,
  onOpenGrantConsent,
}) => {
  const [activeTab, setActiveTab] = useState<
    "overview" | "history" | "encounters" | "medications" | "allergies" | "documents" | "provenance" | "access"
  >("overview");

  if (!isOpen || !patient) return null;

  const canViewDemographics = hasPermission(userRole, "canViewDemographics");
  const canAnchorRecords = hasPermission(userRole, "canAnchorRecords");

  const tabs = [
    { id: "overview", label: "Overview", icon: User },
    { id: "history", label: "Medical History", icon: Activity },
    { id: "encounters", label: "Encounters", icon: Calendar },
    { id: "medications", label: "Medications", icon: Pill },
    { id: "allergies", label: "Allergies", icon: AlertTriangle },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "provenance", label: "Provenance", icon: ShieldCheck },
    { id: "access", label: "Access & Consent", icon: Key },
  ] as const;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-navy-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center space-x-2.5 mb-1.5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {canViewDemographics ? patient.fullName : "[ANONYMIZED CITIZEN]"}
              </h2>
              <StatusBadge
                variant={patient.status === "Verified Active" ? "verified" : patient.status === "Emergency Override" ? "critical" : "neutral"}
                label={patient.status}
              />
            </div>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              National DID: {patient.w3cDID}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {canAnchorRecords && (
              <button
                onClick={onOpenConsultation}
                className="flex items-center px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <Stethoscope className="w-3.5 h-3.5 mr-1.5" /> Start Encounter
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 px-4 scrollbar-none bg-white dark:bg-slate-900">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 py-3 px-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-teal-500 text-teal-600 dark:text-teal-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-700 dark:text-slate-300 text-xs">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block mb-0.5">Demographic ID:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Region & Woreda:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{patient.region} ({patient.kebele})</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Birth Year & Gender:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {canViewDemographics ? `${patient.birthYear} • ${patient.gender}` : "[HIDDEN BY RBAC]"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Blood Type:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{patient.bloodType}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/40 bg-teal-50/50 dark:bg-teal-950/20 space-y-1.5">
                <span className="font-bold text-teal-900 dark:text-teal-300 flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-1 text-teal-500" /> Biometric Smart Card Anchor (ISO 7816)
                </span>
                <p className="text-slate-600 dark:text-slate-300">
                  Card UID: <code className="font-mono">{patient.smartCardUid}</code>
                </p>
                <p className="font-mono text-[11px] text-slate-500 break-all">
                  SHA-256 Digest: {patient.biometricAnchorHash}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-2">Longitudinal Encounter Summary</h4>
                <p className="text-slate-500 dark:text-slate-400">
                  {patient.encounters.length} validated encounters anchored on-chain with zero-knowledge AES-256 encrypted payloads.
                </p>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-2">Diagnosed Chronic Conditions</h4>
              {patient.chronicConditions.length > 0 ? (
                <ul className="space-y-2">
                  {patient.chronicConditions.map((cond, i) => (
                    <li key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{cond}</span>
                      <StatusBadge variant="info" label="Under Treatment" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400">No chronic conditions registered.</p>
              )}
            </div>
          )}

          {activeTab === "encounters" && (
            <div className="space-y-3">
              {patient.encounters.length > 0 ? (
                patient.encounters.map((enc) => (
                  <div key={enc.encounterId} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Encounter #{enc.encounterId}</span>
                      <StatusBadge variant="verified" label={`State: ${enc.state === 6 ? "Settled" : "RecordAnchored"}`} />
                    </div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">{enc.diagnosis}</p>
                    <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
                      <div>Facility: {enc.facilityName}</div>
                      <div>Attending Doctor: {enc.physicianName}</div>
                      <div>IPFS CID: {enc.ipfsCid}</div>
                      <div>CBHI Settlement: {enc.claimAmountETB} eETB</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">No recorded clinical encounters yet.</div>
              )}
            </div>
          )}

          {activeTab === "medications" && (
            <div className="space-y-3">
              {patient.prescriptions.length > 0 ? (
                patient.prescriptions.map((rx) => (
                  <div key={rx.prescriptionId} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{rx.medicationName}</span>
                      <StatusBadge variant={rx.dispensed ? "verified" : "warning"} label={rx.dispensed ? "Dispensed" : "Pending Refill"} />
                    </div>
                    <div className="text-slate-500">Dosage: {rx.dosage}</div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Remaining Quantity: {rx.remainingQuantity} / {rx.quantity} doses • Valid until: {rx.validUntil}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">No active electronic prescriptions.</div>
              )}
            </div>
          )}

          {activeTab === "allergies" && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-red-600 dark:text-red-400 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1.5" /> High-Priority Clinical Allergy Alerts
              </h4>
              <div className="space-y-2">
                {patient.allergies.map((all, i) => (
                  <div key={i} className="p-3 rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 text-red-700 dark:text-red-300 font-semibold flex items-center justify-between">
                    <span>{all}</span>
                    <span className="text-[11px] uppercase tracking-wider text-red-500 font-bold">Severe Reaction</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-3">
              <p className="text-slate-500">
                All clinical records are encrypted with AES-256-GCM. Raw clinical data is never accessible without the patient's symmetric key.
              </p>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-mono text-[11px] space-y-1">
                <div>Document Type: Diagnostic Report & Vitals (Encrypted)</div>
                <div>Storage Protocol: Decentralized IPFS</div>
                <div className="flex items-center text-teal-600 dark:text-teal-400">
                  <span>CID: QmX84kF29mP9A108bF819ZKa820B10892aPqm1089bZ192</span>
                  <ExternalLink className="w-3 h-3 ml-1" />
                </div>
              </div>
            </div>
          )}

          {activeTab === "provenance" && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">Blockchain Record Provenance Timeline</h4>
              <div className="relative pl-6 border-l border-teal-500 space-y-4">
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-3 h-3 rounded-full bg-teal-500 border-2 border-white dark:border-slate-900" />
                  <strong className="block text-slate-800 dark:text-slate-200">Patient Enrolled (Soulbound DID SBT)</strong>
                  <span className="text-[11px] text-slate-400">Block #4880192 • Kebele Registrar #04</span>
                </div>
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-3 h-3 rounded-full bg-teal-500 border-2 border-white dark:border-slate-900" />
                  <strong className="block text-slate-800 dark:text-slate-200">Encounter Record Anchored</strong>
                  <span className="text-[11px] text-slate-400">Block #4892014 • Tikur Anbessa Hospital</span>
                </div>
                <div className="relative">
                  <div className="absolute -left-[31px] top-0 w-3 h-3 rounded-full bg-teal-500 border-2 border-white dark:border-slate-900" />
                  <strong className="block text-slate-800 dark:text-slate-200">CBHI Insurance Reimbursement Settled</strong>
                  <span className="text-[11px] text-slate-400">Block #4892015 • FMoH Central Pool Escrow</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "access" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">Time-Locked Consent Tickets</h4>
                {onOpenGrantConsent && (
                  <button
                    onClick={onOpenGrantConsent}
                    className="flex items-center px-2.5 py-1 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg shadow-xs"
                  >
                    <Key className="w-3 h-3 mr-1" /> Grant Consent / Tap Card
                  </button>
                )}
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1">
                <div className="flex justify-between items-center">
                  <strong className="text-slate-800 dark:text-slate-200">Dr. Almaz Mengistu (PHYSICIAN_ROLE)</strong>
                  <StatusBadge variant="verified" label="Active" />
                </div>
                <div className="text-[11px] text-slate-500">Granted via ISO 7816 Smart Card Tap • Valid for 24 Hours</div>
                <div className="text-[11px] font-mono text-slate-400">Duration remaining: 18h 42m</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

