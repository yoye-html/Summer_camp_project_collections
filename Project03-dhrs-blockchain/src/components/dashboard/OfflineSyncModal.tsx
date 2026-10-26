import React, { useState } from "react";
import { RefreshCw, Satellite, CheckCircle, Database, X } from "lucide-react";
import { buildMerkleTree } from "@/lib/merkle";
import { AuditEvent } from "@/types";

interface OfflineSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (event: AuditEvent) => void;
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [merkleRootResult, setMerkleRootResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartSync = async () => {
    setIsSyncing(true);

    // Simulated rural health post cached batch
    const sampleOfflineRecords = [
      {
        patientAddress: "0x7a39d882194b1509a25b16f391e5b4b2794c9f18",
        recordHash: "0x9812401928019a820b1928a019280b1928a01928019280192801928019280192",
      },
      {
        patientAddress: "0x4918f391e5b4b2794c9f187a39d882194b1509a2",
        recordHash: "0x7a81920b1928a019280192801928019280192801928019280192801928019280",
      },
      {
        patientAddress: "0x1b6B79D206a25b16391E5B4B2794c9f18B50478e",
        recordHash: "0x12b32525f34e2c81729b82910fa9108b2910a892a0149a5f19277fc31a76a59f",
      },
    ];

    const tree = await buildMerkleTree(sampleOfflineRecords);
    setMerkleRootResult(tree.merkleRoot);

    setTimeout(() => {
      setIsSyncing(false);
      setSyncComplete(true);

      const auditEvent: AuditEvent = {
        id: `EVT-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
        eventType: "OFFLINE_MERKLE_SYNC",
        recordReference: "FAC-ET-OR-POST-09",
        actorAddress: "0x892a0149a5f19277fc31a76a59f12b32525f34e2",
        actorRole: "Health Extension Worker (HEALTH_FACILITY_ROLE)",
        facility: "Koka Negewo Kebele Health Post",
        verificationStatus: "Confirmed on Ledger",
        txHash: "0x" + Array.from(window.crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join(""),
        blockNumber: 4892016,
        details: `Synced 38 cached SQLite records from rural health post. Merkle root ${tree.merkleRoot.slice(0, 16)}... anchored via Starlink link.`,
        integrityProofValid: true,
      };

      onSuccess(auditEvent);
    }, 1500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-900/40 p-6 shadow-2xl text-slate-800 dark:text-slate-100">
        <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <Satellite className="w-6 h-6" />
            </div>
            <div>
              <h3 id="sync-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Rural Kebele Health Post Merkle Sync
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solidity Contract: <code className="font-mono text-teal-600 dark:text-teal-400">syncOfflineFacilityRecords()</code> (Phase III, Project 12)
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

        <div className="my-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400 flex items-center">
              <Database className="w-4 h-4 mr-1 text-teal-500" /> Facility:
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Koka Negewo Kebele Health Post (East Shewa)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Connectivity Channel:</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-medium">
              Starlink High-Latency Sync
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Pending Buffered Records:</span>
            <strong className="text-teal-600 dark:text-teal-400 text-sm">38 SQLite Offline Encounters</strong>
          </div>
        </div>

        {syncComplete ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Batch Synchronized Successfully</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              38 local clinic encounters were combined into a double-hashed cryptographic Merkle tree and verified on-chain.
            </p>
            {merkleRootResult && (
              <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs text-teal-600 dark:text-teal-400 break-all">
                New Merkle Root: {merkleRootResult}
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-md transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              When Starlink or Ethio Telecom 3G connectivity reconnects, health workers trigger this sync. The local client hashes records and submits a single compact Merkle root and proof array, consuming minimal satellite bandwidth.
            </p>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleStartSync}
                className="px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-md transition-colors flex items-center"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Computing Merkle Proofs...
                  </>
                ) : (
                  "Execute Satellite Merkle Sync"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

