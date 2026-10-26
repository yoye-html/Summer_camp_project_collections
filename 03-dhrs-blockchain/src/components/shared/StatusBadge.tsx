import React from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, ShieldCheck } from "lucide-react";

export type BadgeVariant = "verified" | "warning" | "critical" | "info" | "neutral";

interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  icon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  label,
  icon = true,
  className = "",
}) => {
  const styles: Record<BadgeVariant, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    verified: {
      bg: "bg-teal-50 dark:bg-teal-950/40",
      text: "text-teal-700 dark:text-teal-300",
      border: "border-teal-200 dark:border-teal-800",
      icon: <ShieldCheck className="w-3.5 h-3.5 mr-1 text-teal-600 dark:text-teal-400" aria-hidden="true" />,
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
      icon: <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" aria-hidden="true" />,
    },
    critical: {
      bg: "bg-red-50 dark:bg-red-950/40",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-200 dark:border-red-800",
      icon: <AlertCircle className="w-3.5 h-3.5 mr-1 text-red-600 dark:text-red-400" aria-hidden="true" />,
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/40",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-200 dark:border-blue-800",
      icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
    },
    neutral: {
      bg: "bg-slate-100 dark:bg-slate-800",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-200 dark:border-slate-700",
      icon: <AlertTriangle className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" aria-hidden="true" />,
    },
  };

  const style = styles[variant] || styles.neutral;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      {icon && style.icon}
      <span>{label}</span>
    </span>
  );
};

