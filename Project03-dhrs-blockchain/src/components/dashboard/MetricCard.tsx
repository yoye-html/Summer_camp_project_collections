import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendPositive?: boolean;
  icon: LucideIcon;
  subtext?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  trend,
  trendPositive = true,
  icon: Icon,
  subtext,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 ${
        onClick ? "cursor-pointer hover:border-teal-500 hover:shadow-md hover:-translate-y-0.5" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-baseline space-x-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-semibold ${
              trendPositive ? "text-teal-600 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {subtext && (
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 font-medium truncate">
          {subtext}
        </p>
      )}
    </div>
  );
};

