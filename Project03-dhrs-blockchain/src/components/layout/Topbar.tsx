import React from "react";
import {
  Search,
  Lock,
  Sun,
  Moon,
  Wallet,
  Building,
  UserCheck,
  AlertOctagon,
  ChevronRight,
} from "lucide-react";
import { UserRole } from "@/types";

interface TopbarProps {
  currentView: string;
  onSearchFocus: () => void;
  userRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  onLockSession: () => void;
  onOpenBreakGlass: () => void;
  walletAccount: string | null;
  isSimulated: boolean;
  onConnectWallet: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  onSearchFocus,
  userRole,
  onChangeRole,
  onLockSession,
  onOpenBreakGlass,
  walletAccount,
  isSimulated,
  onConnectWallet,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const viewTitles: Record<string, string> = {
    overview: "Dashboard Overview",
    registry: "National Patient Registry",
    audit: "Audit & Compliance Explorer",
    facilities: "Connected Healthcare Facilities",
    auctions: "EPHI Drug Procurement Auctions",
    sync: "Satellite Merkle Sync Center",
    settings: "Consortium Governance Settings",
  };

  return (
    <header className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-200 z-20">
      {/* Breadcrumbs */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="font-semibold text-slate-400">DHRS-ET</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
        <span className="font-bold text-slate-800 dark:text-white">
          {viewTitles[currentView] || "Overview"}
        </span>
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Break-Glass Emergency Button */}
        <button
          onClick={onOpenBreakGlass}
          className="hidden md:flex items-center px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-xl text-xs font-bold transition-colors shadow-xs"
          title="Emergency Trauma Override (2-of-3 Multi-Sig)"
        >
          <AlertOctagon className="w-3.5 h-3.5 mr-1.5" />
          <span>Break-Glass Protocol</span>
        </button>

        {/* Demonstration Role Switcher */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <UserCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <select
            value={userRole}
            onChange={(e) => onChangeRole(e.target.value as UserRole)}
            className="bg-transparent text-xs font-semibold focus:outline-none text-slate-800 dark:text-slate-200 cursor-pointer"
            aria-label="Demo Role Switcher"
          >
            <option value="clinician">Role: Clinician (Doctor)</option>
            <option value="auditor">Role: Data Auditor</option>
            <option value="facility_admin">Role: Facility Admin</option>
            <option value="system_admin">Role: System Admin (FMoH)</option>
          </select>
        </div>

        {/* Web3 Wallet / In-Memory Provider Connection */}
        <button
          onClick={onConnectWallet}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors shadow-xs ${
            walletAccount
              ? "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200"
          }`}
          title={isSimulated ? "Consortium Simulated Identity" : "Connected Browser Wallet"}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>
            {walletAccount
              ? `${walletAccount.slice(0, 6)}...${walletAccount.slice(-4)}`
              : "Connect Wallet"}
          </span>
        </button>

        {/* Session Lock Button */}
        <button
          onClick={onLockSession}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Lock Terminal Session"
        >
          <Lock className="w-4 h-4" />
        </button>

        {/* Dark/Light Mode */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Toggle Color Theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};

