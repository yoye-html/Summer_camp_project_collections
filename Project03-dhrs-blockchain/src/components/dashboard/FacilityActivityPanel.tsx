import React from "react";
import { Building2, Wifi, WifiOff, Satellite, RefreshCw } from "lucide-react";
import { Facility } from "@/types";

interface FacilityActivityPanelProps {
  facilities: Facility[];
  onTriggerSync: (facility: Facility) => void;
}

export const FacilityActivityPanel: React.FC<FacilityActivityPanelProps> = ({
  facilities,
  onTriggerSync,
}) => {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Connected Regional Facilities & Posts
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Monitors real-time connectivity, Starlink telemetry, and pending local SQLite buffers.
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 my-2">
        {facilities.map((fac) => {
          const isOffline = fac.connectivityStatus === "Offline Mode";
          const isStarlink = fac.connectivityStatus === "Intermittent (Starlink)";

          return (
            <div
              key={fac.id}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 rounded-xl px-2 transition-colors"
            >
              <div className="flex items-start space-x-3">
                <div
                  className={`p-2 rounded-xl mt-0.5 ${
                    isOffline
                      ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                      : isStarlink
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                      : "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {fac.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                      {fac.region}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                    <span>{fac.type}</span>
                    <span>•</span>
                    <span>Last Sync: {fac.lastSyncTimestamp}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {fac.cbhiPendingReimbursementETB.toLocaleString()} eETB
                  </div>
                  <span className="text-[10px] text-slate-400">CBHI Pull Balance</span>
                </div>

                {fac.pendingSyncQueue > 0 ? (
                  <button
                    onClick={() => onTriggerSync(fac)}
                    className="flex items-center px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    <span>Sync ({fac.pendingSyncQueue})</span>
                  </button>
                ) : (
                  <div className="flex items-center text-teal-600 dark:text-teal-400 text-xs font-medium px-2 py-1">
                    <Wifi className="w-3.5 h-3.5 mr-1" /> Synced
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between items-center">
        <span>6 Regional Health Bureaus (RHB) Connected</span>
        <span className="text-teal-600 dark:text-teal-400 font-semibold">100% Accreditation Verified</span>
      </div>
    </div>
  );
};

