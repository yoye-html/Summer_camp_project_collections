import React, { useState, useMemo } from "react";
import { Search, Filter, ShieldCheck, Eye, Database } from "lucide-react";
import { AuditEvent } from "@/types";
import { StatusBadge } from "../shared/StatusBadge";
import { AuditEventDrawer } from "./AuditEventDrawer";

interface AuditExplorerProps {
  events: AuditEvent[];
}

export const AuditExplorer: React.FC<AuditExplorerProps> = ({ events }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesSearch =
        ev.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.recordReference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.actorAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.txHash.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === "ALL" || ev.eventType === selectedType;
      return matchesSearch && matchesType;
    });
  }, [events, searchQuery, selectedType]);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Event ID, Record Reference, Actor Address, Tx Hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Event Types</option>
            <option value="RECORD_ANCHORED">RECORD_ANCHORED</option>
            <option value="EMERGENCY_BREAK_GLASS">EMERGENCY_BREAK_GLASS</option>
            <option value="OFFLINE_MERKLE_SYNC">OFFLINE_MERKLE_SYNC</option>
            <option value="PULL_PAYMENT_WITHDRAWN">PULL_PAYMENT_WITHDRAWN</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/60 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4 font-semibold">Event ID</th>
                <th className="py-3 px-4 font-semibold">Event Type</th>
                <th className="py-3 px-4 font-semibold">Record Reference</th>
                <th className="py-3 px-4 font-semibold">Facility</th>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Integrity Proof</th>
                <th className="py-3 px-4 font-semibold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredEvents.map((ev) => (
                <tr
                  key={ev.id}
                  className="hover:bg-teal-50/30 dark:hover:bg-teal-950/10 transition-colors"
                >
                  <td className="py-3.5 px-4 font-mono font-semibold text-teal-600 dark:text-teal-400">
                    {ev.id}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                    {ev.eventType}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                    {ev.recordReference}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{ev.facility}</td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">{ev.timestamp}</td>
                  <td className="py-3.5 px-4">
                    <StatusBadge variant="verified" label="Confirmed on Ledger" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedEvent(ev)}
                      className="p-1.5 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="View Event Ledger Proof"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AuditEventDrawer
        event={selectedEvent}
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
};

