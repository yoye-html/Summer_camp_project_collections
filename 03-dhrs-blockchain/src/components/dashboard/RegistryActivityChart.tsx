import React, { useState } from "react";
import { Activity, Calendar, Info } from "lucide-react";

type TimeRange = "day" | "week" | "month";

interface DataPoint {
  label: string;
  encounters: number;
  syncs: number;
}

const DATA_SETS: Record<TimeRange, DataPoint[]> = {
  day: [
    { label: "00:00", encounters: 42, syncs: 5 },
    { label: "04:00", encounters: 18, syncs: 2 },
    { label: "08:00", encounters: 320, syncs: 28 },
    { label: "12:00", encounters: 512, syncs: 45 },
    { label: "16:00", encounters: 480, syncs: 38 },
    { label: "20:00", encounters: 190, syncs: 14 },
  ],
  week: [
    { label: "Mon", encounters: 2850, syncs: 210 },
    { label: "Tue", encounters: 3120, syncs: 245 },
    { label: "Wed", encounters: 3412, syncs: 290 },
    { label: "Thu", encounters: 3200, syncs: 260 },
    { label: "Fri", encounters: 3580, syncs: 310 },
    { label: "Sat", encounters: 1420, syncs: 95 },
    { label: "Sun", encounters: 980, syncs: 60 },
  ],
  month: [
    { label: "Week 1", encounters: 18400, syncs: 1450 },
    { label: "Week 2", encounters: 21200, syncs: 1680 },
    { label: "Week 3", encounters: 23100, syncs: 1890 },
    { label: "Week 4", encounters: 22400, syncs: 1740 },
  ],
};

export const RegistryActivityChart: React.FC = () => {
  const [range, setRange] = useState<TimeRange>("week");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const data = DATA_SETS[range];
  const maxEncounters = Math.max(...data.map((d) => d.encounters)) * 1.15;

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              National Registry Activity & Encounters
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-[11px] font-semibold">
              Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Cryptographic IPFS anchor transactions and rural Kebele offline Merkle sync events.
          </p>
        </div>

        <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
          {(["day", "week", "month"] as const).map((r) => (
            <button
              key={r}
              onClick={() => {
                setRange(r);
                setHoveredIdx(null);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                range === r
                  ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {r === "day" ? "24 Hours" : r === "week" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="py-6">
        <div className="h-56 w-full relative flex items-end justify-between space-x-2 px-2">
          {data.map((point, i) => {
            const heightPercent = (point.encounters / maxEncounters) * 100;
            const isHovered = hoveredIdx === i;

            return (
              <div
                key={point.label}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute -top-12 z-20 px-2.5 py-1.5 rounded-lg bg-navy-950 text-white text-[11px] font-mono shadow-xl whitespace-nowrap pointer-events-none">
                    <div>{point.encounters.toLocaleString()} Encounters</div>
                    <div className="text-teal-400">{point.syncs} Merkle Syncs</div>
                  </div>
                )}

                {/* Bars */}
                <div className="w-full max-w-[42px] flex items-end justify-center h-full">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      isHovered
                        ? "bg-teal-500 shadow-lg shadow-teal-500/20"
                        : "bg-teal-600/80 dark:bg-teal-500/70 group-hover:bg-teal-500"
                    }`}
                  />
                </div>

                {/* Label */}
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-2 truncate w-full text-center">
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600 mr-1.5" /> Clinical Encounters Anchored
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 mr-1.5" /> Rural Merkle Batches
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-400">Target Latency: &lt; 2.5s</span>
      </div>
    </div>
  );
};

