import React from "react";
import { Activity, CheckCircle2, ShieldCheck, Database, Cpu, Wifi } from "lucide-react";

export const SystemHealthPanel: React.FC = () => {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-teal-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Consortium Health & Node Telemetry
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 text-[10px] font-semibold border border-teal-200 dark:border-teal-800">
          Optimal (99.98% Uptime)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">Consortium Protocol</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center">
            <Cpu className="w-3.5 h-3.5 mr-1 text-teal-500" /> Besu EVM / QBFT
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">Storage Engine</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center">
            <Database className="w-3.5 h-3.5 mr-1 text-teal-500" /> IPFS + ERC-7201
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">Rural Satellite Feed</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center">
            <Wifi className="w-3.5 h-3.5 mr-1 text-amber-500" /> Starlink / Ethio 3G
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[11px]">Zero-Knowledge Shield</span>
          <span className="font-semibold text-teal-600 dark:text-teal-400 flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> AES-256-GCM Active
          </span>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 text-[11px] text-blue-800 dark:text-blue-300">
        <strong>Demo Mode Notice:</strong> Operational metrics and events are populated from the verified DHRS-ET synthetic data layer. Connect a local Besu node to stream live blocks.
      </div>
    </div>
  );
};

