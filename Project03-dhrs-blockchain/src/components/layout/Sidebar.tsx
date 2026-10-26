import React from "react";
import {
  Activity,
  Users,
  ShieldCheck,
  Building2,
  Gavel,
  Satellite,
  Settings,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
} from "lucide-react";
import { UserRole } from "@/types";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  userRole: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  userRole,
}) => {
  const navItems = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "registry", label: "Patient Registry", icon: Users },
    { id: "audit", label: "Audit & Compliance", icon: ShieldCheck },
    { id: "facilities", label: "Facilities & Posts", icon: Building2 },
    { id: "auctions", label: "EPHI Drug Procurement", icon: Gavel },
    { id: "sync", label: "Satellite Sync Center", icon: Satellite },
    { id: "settings", label: "Consortium Settings", icon: Settings },
  ];

  return (
    <aside
      className={`relative flex flex-col bg-navy-950 border-r border-slate-800 text-slate-300 transition-all duration-300 select-none z-30 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-800/80">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center flex-shrink-0 text-teal-400 shadow-sm">
            <HeartPulse className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <span className="font-bold text-sm tracking-tight text-white block">
                DHRS-ET
              </span>
              <span className="text-[10px] text-teal-400 font-medium tracking-wide block uppercase">
                Ethiopia Health Registry
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-xs"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-teal-400" : "text-slate-400"}`} />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Consortium Badge */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-400 bg-navy-950/40">
          <div className="flex items-center space-x-1.5 mb-1 text-slate-200 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>FMoH / EPHI Consortium</span>
          </div>
          <p className="text-slate-500 text-[10px] leading-relaxed">
            Enterprise EVM QBFT Consensus • Besu Permissioned Network
          </p>
        </div>
      )}
    </aside>
  );
};

