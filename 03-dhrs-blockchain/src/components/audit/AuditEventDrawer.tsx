import React from "react";
import { X, ShieldCheck, CheckCircle2, Clock, Hash, Database, ExternalLink } from "lucide-react";
import { AuditEvent } from "@/types";
import { StatusBadge } from "../shared/StatusBadge";

interface AuditEventDrawerProps {
  event: AuditEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AuditEventDrawer: React.FC<AuditEventDrawerProps> = ({ event, isOpen, onClose }) => {
  if (!isOpen || !event) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-navy-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="font-mono text-xs text-slate-500 font-bold">{event.id}</span>
              <StatusBadge variant="verified" label={event.verificationStatus} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{event.eventType}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-700 dark:text-slate-300">
          <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/40 bg-teal-50/50 dark:bg-teal-950/20 space-y-2">
            <h4 className="font-bold text-sm text-teal-900 dark:text-teal-300 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-teal-500" />
              Cryptographic Integrity Verification
            </h4>
            <p className="text-slate-600 dark:text-slate-300">
              The cryptographic proof for this event matches the state root on the consortium ledger.
            </p>
            <div className="flex items-center text-teal-700 dark:text-teal-300 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-teal-500" /> State transition confirmed by QBFT consensus
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
              Event Details & Context
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2.5">
              <div>
                <span className="text-slate-400 block mb-0.5">Affected Record Reference:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{event.recordReference}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Initiating Actor / Role:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{event.actorRole}</span>
                <span className="font-mono text-[11px] text-slate-500 block truncate">{event.actorAddress}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Healthcare Facility:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{event.facility}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Execution Timestamp:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{event.timestamp}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
              Consortium Blockchain Anchors
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-900 text-slate-300 font-mono text-[11px] space-y-2 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center">
                  <Database className="w-3.5 h-3.5 mr-1 text-teal-400" /> Block Height:
                </span>
                <span className="text-teal-400 font-bold">#{event.blockNumber}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block">Transaction Hash:</span>
                <span className="text-slate-200 break-all">{event.txHash}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
              Auditor Narrative
            </h4>
            <p className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 leading-relaxed">
              {event.details}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

