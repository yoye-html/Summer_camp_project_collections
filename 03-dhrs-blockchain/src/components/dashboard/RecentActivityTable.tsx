import React from "react";
import { AuditEvent } from "@/types";
import { StatusBadge } from "../shared/StatusBadge";
import { ArrowUpRight } from "lucide-react";

interface RecentActivityTableProps {
  events: AuditEvent[];
  onViewAll: () => void;
  onSelectEvent: (event: AuditEvent) => void;
}

export const RecentActivityTable: React.FC<RecentActivityTableProps> = ({
  events,
  onViewAll,
  onSelectEvent,
}) => {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Recent Ledger & Registry Activity
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Immutable audit events anchored across the Ethiopian health consortium.
          </p>
        </div>
        <button
          onClick={onViewAll}
          className="flex items-center text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700"
        >
          <span>View All in Audit Explorer</span>
          <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800/60 my-2">
        {events.slice(0, 5).map((ev) => (
          <div
            key={ev.id}
            onClick={() => onSelectEvent(ev)}
            className="py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 rounded-xl px-2 transition-colors cursor-pointer group"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {ev.eventType}
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Ref: {ev.recordReference}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate max-w-sm">
                {ev.facility} • {ev.actorRole}
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <span className="font-mono text-[11px] text-slate-400 hidden sm:block">
                {ev.timestamp.slice(11, 19)}
              </span>
              <StatusBadge variant="verified" label="Confirmed" />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex justify-between items-center">
        <span>Consortium Consensus: QBFT 2.0 (Zero Gas Friction)</span>
        <span className="font-mono text-[11px]">Finality: 1 Second</span>
      </div>
    </div>
  );
};

