import React, { useState, useEffect } from "react";
import {
  Users,
  ShieldCheck,
  Building2,
  RefreshCw,
  AlertOctagon,
  Gavel,
  Coins,
  TrendingDown,
  Lock,
  ArrowUpRight,
  Database,
  Satellite,
  CheckCircle2,
} from "lucide-react";
import {
  UserRole,
  PatientRecord,
  AuditEvent,
  Facility,
  ReverseAuction,
  ClinicalEncounter,
} from "@/types";
import {
  SYNTHETIC_PATIENTS,
  SYNTHETIC_AUDIT_EVENTS,
  SYNTHETIC_FACILITIES,
  SYNTHETIC_AUCTIONS,
  SYNTHETIC_METRICS,
} from "@/data/syntheticData";
import { connectWalletProvider } from "@/lib/web3";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RegistryActivityChart } from "@/components/dashboard/RegistryActivityChart";
import { FacilityActivityPanel } from "@/components/dashboard/FacilityActivityPanel";
import { RecentActivityTable } from "@/components/dashboard/RecentActivityTable";
import { SystemHealthPanel } from "@/components/dashboard/SystemHealthPanel";
import { PatientRegistryTable } from "@/components/registry/PatientRegistryTable";
import { PatientDetailDrawer } from "@/components/registry/PatientDetailDrawer";
import { EncounterConsultationModal } from "@/components/registry/EncounterConsultationModal";
import { GrantConsentModal } from "@/components/registry/GrantConsentModal";
import { EmergencyBreakGlassModal } from "@/components/dashboard/EmergencyBreakGlassModal";
import { OfflineSyncModal } from "@/components/dashboard/OfflineSyncModal";
import { AuctionProcurementModal } from "@/components/dashboard/AuctionProcurementModal";
import { AuditExplorer } from "@/components/audit/AuditExplorer";
import { AuditEventDrawer } from "@/components/audit/AuditEventDrawer";
import { SessionLockModal } from "@/components/shared/SessionLockModal";
import { StatusBadge } from "@/components/shared/StatusBadge";

export function App() {
  // Navigation & Shell
  const [currentView, setCurrentView] = useState("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("clinician");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSessionLocked, setIsSessionLocked] = useState(false);

  // Web3 State
  const [walletAccount, setWalletAccount] = useState<string | null>(
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
  );
  const [isSimulatedWallet, setIsSimulatedWallet] = useState(true);
  const [cbhiPullBalance, setCbhiPullBalance] = useState(45000);

  // Registry & State
  const [patients, setPatients] = useState<PatientRecord[]>(SYNTHETIC_PATIENTS);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(SYNTHETIC_AUDIT_EVENTS);
  const [facilities, setFacilities] = useState<Facility[]>(SYNTHETIC_FACILITIES);
  const [auctions, setAuctions] = useState<ReverseAuction[]>(SYNTHETIC_AUCTIONS);
  const [metrics, setMetrics] = useState(SYNTHETIC_METRICS);

  // Active Modals & Drawers
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [consultationPatient, setConsultationPatient] = useState<PatientRecord | null>(null);
  const [consentPatient, setConsentPatient] = useState<PatientRecord | null>(null);
  const [selectedAuditEvent, setSelectedAuditEvent] = useState<AuditEvent | null>(null);
  const [isBreakGlassOpen, setIsBreakGlassOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Apply dark mode class to HTML
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Connect Wallet
  const handleConnectWallet = async () => {
    const result = await connectWalletProvider();
    setWalletAccount(result.account);
    setIsSimulatedWallet(result.isSimulated);
    setBannerNotice(
      result.isSimulated
        ? "Connected to Consortium In-Memory Node (Dr. Almaz Mengistu • PHYSICIAN_ROLE)"
        : `Connected MetaMask Account ${result.account.slice(0, 6)}...`
    );
  };

  // Add Encounter Handler
  const handleEncounterCreated = (encounter: ClinicalEncounter, auditEvent: AuditEvent) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === encounter.patientId) {
          return {
            ...p,
            encounters: [encounter, ...p.encounters],
            lastUpdated: "Just now",
          };
        }
        return p;
      })
    );
    setAuditEvents((prev) => [auditEvent, ...prev]);
    setMetrics((prev) => ({
      ...prev,
      recordsUpdatedToday: prev.recordsUpdatedToday + 1,
    }));
    setBannerNotice(`Encrypted encounter #${encounter.encounterId} anchored with IPFS CID ${encounter.ipfsCid.slice(0, 14)}...`);
  };

  // Emergency Break-Glass Handler
  const handleBreakGlassSuccess = (event: AuditEvent) => {
    setAuditEvents((prev) => [event, ...prev]);
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === event.recordReference) {
          return {
            ...p,
            status: "Emergency Override",
            lastUpdated: "Just now",
          };
        }
        return p;
      })
    );
    setBannerNotice(`2-of-3 Break-Glass Override broadcasted. Strict 24h emergency access granted.`);
  };

  // Merkle Sync Handler
  const handleSyncSuccess = (event: AuditEvent) => {
    setAuditEvents((prev) => [event, ...prev]);
    setFacilities((prev) =>
      prev.map((f) => {
        if (f.id === event.recordReference) {
          return {
            ...f,
            pendingSyncQueue: 0,
            connectivityStatus: "Online (Fiber/4G)",
            lastSyncTimestamp: "Just now via Starlink",
          };
        }
        return f;
      })
    );
    setMetrics((prev) => ({
      ...prev,
      pendingOfflineSyncs: Math.max(0, prev.pendingOfflineSyncs - 38),
    }));
    setBannerNotice("Satellite Merkle diff verified and anchored on-chain.");
  };

  // Reverse Auction Bid Handler
  const handlePlaceBid = (auctionId: number, bidAmount: number, supplierName: string) => {
    setAuctions((prev) =>
      prev.map((auc) => {
        if (auc.auctionId === auctionId) {
          return {
            ...auc,
            currentLowestBidETB: bidAmount,
            winningSupplier: supplierName,
            bidsCount: auc.bidsCount + 1,
          };
        }
        return auc;
      })
    );

    const auditEv: AuditEvent = {
      id: `EVT-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      eventType: "AUCTION_BID_PLACED",
      recordReference: `AUC-${auctionId}`,
      actorAddress: walletAccount || "0xSupplier...",
      actorRole: "Accredited Pharmaceutical Supplier",
      facility: "EPHI Procurement Center",
      verificationStatus: "Confirmed on Ledger",
      txHash: "0x" + Array.from(window.crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join(""),
      blockNumber: 4892018,
      details: `New lowest reverse bid of ${bidAmount.toLocaleString()} eETB placed by ${supplierName}.`,
      integrityProofValid: true,
    };
    setAuditEvents((prev) => [auditEv, ...prev]);
  };

  // CBHI Pull Payment Withdrawal (Checks-Effects-Interactions)
  const handleWithdrawPullPayment = () => {
    if (cbhiPullBalance === 0) return;
    const amount = cbhiPullBalance;
    setCbhiPullBalance(0);

    const auditEv: AuditEvent = {
      id: `EVT-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      eventType: "PULL_PAYMENT_WITHDRAWN",
      recordReference: "CBHI-POOL-2026",
      actorAddress: walletAccount || "0xFacility...",
      actorRole: "Health Facility Administrator",
      facility: "Tikur Anbessa Specialized Hospital",
      verificationStatus: "Confirmed on Ledger",
      txHash: "0x" + Array.from(window.crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join(""),
      blockNumber: 4892019,
      details: `Withdrew ${amount.toLocaleString()} eETB via Checks-Effects-Interactions (CEI). Escrow balance zeroed.`,
      integrityProofValid: true,
    };
    setAuditEvents((prev) => [auditEv, ...prev]);
    setBannerNotice(`Successfully pulled ${amount.toLocaleString()} eETB from CBHI escrow into facility treasury.`);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view);
          setSelectedPatient(null);
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        userRole={userRole}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Topbar
          currentView={currentView}
          onSearchFocus={() => setCurrentView("registry")}
          userRole={userRole}
          onChangeRole={(r) => {
            setUserRole(r);
            setBannerNotice(`Switched demonstration role to ${r.replace("_", " ").toUpperCase()}`);
          }}
          onLockSession={() => setIsSessionLocked(true)}
          onOpenBreakGlass={() => setIsBreakGlassOpen(true)}
          walletAccount={walletAccount}
          isSimulated={isSimulatedWallet}
          onConnectWallet={handleConnectWallet}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />

        {/* Global Operational Notification Banner */}
        {bannerNotice && (
          <div className="bg-teal-600 text-white px-6 py-2 text-xs flex items-center justify-between shadow-xs">
            <span className="flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
              {bannerNotice}
            </span>
            <button
              onClick={() => setBannerNotice(null)}
              className="text-teal-200 hover:text-white font-bold text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Scrollable Workspace Container */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* VIEW: OVERVIEW DASHBOARD */}
          {currentView === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Metric Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                  label="Registered Citizens"
                  value={metrics.totalRegisteredPatients.toLocaleString()}
                  trend="+1,240 this month"
                  icon={Users}
                  subtext="Biometric DID SBT Anchored"
                  onClick={() => setCurrentView("registry")}
                />
                <MetricCard
                  label="Encounters Today"
                  value={metrics.recordsUpdatedToday.toLocaleString()}
                  trend="+12% vs avg"
                  icon={RefreshCw}
                  subtext="AES-256 Encrypted on IPFS"
                />
                <MetricCard
                  label="Accredited Facilities"
                  value={metrics.connectedFacilities}
                  trend="100% Verified"
                  icon={Building2}
                  subtext="6 Regional Health Bureaus"
                  onClick={() => setCurrentView("facilities")}
                />
                <MetricCard
                  label="Pending Merkle Sync"
                  value={metrics.pendingOfflineSyncs}
                  trend="Satellite Buffer"
                  trendPositive={false}
                  icon={Satellite}
                  subtext="Rural SQLite Health Posts"
                  onClick={() => setIsSyncModalOpen(true)}
                />
                <MetricCard
                  label="CBHI Pull Payment Escrow"
                  value={`${cbhiPullBalance.toLocaleString()} eETB`}
                  trend={cbhiPullBalance > 0 ? "Ready to Claim" : "Settled"}
                  icon={Coins}
                  subtext="Click to Pull Funds (CEI)"
                  onClick={handleWithdrawPullPayment}
                />
              </div>

              {/* Activity Chart & Facility Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <RegistryActivityChart />
                </div>
                <div>
                  <SystemHealthPanel />
                </div>
              </div>

              {/* Facilities & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FacilityActivityPanel
                  facilities={facilities}
                  onTriggerSync={() => setIsSyncModalOpen(true)}
                />
                <RecentActivityTable
                  events={auditEvents}
                  onViewAll={() => setCurrentView("audit")}
                  onSelectEvent={(ev) => setSelectedAuditEvent(ev)}
                />
              </div>
            </div>
          )}

          {/* VIEW: PATIENT REGISTRY */}
          {currentView === "registry" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    National Patient Registry & Soulbound Identity Workspace
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Interoperable W3C DID identity bound to ISO 7816 smart cards. Double-actions prevented by O(1) mappings.
                  </p>
                </div>
              </div>

              <PatientRegistryTable
                patients={patients}
                onSelectPatient={(p) => setSelectedPatient(p)}
                onOpenConsultation={(p) => setConsultationPatient(p)}
                userRole={userRole}
              />
            </div>
          )}

          {/* VIEW: AUDIT & COMPLIANCE */}
          {currentView === "audit" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Audit & Compliance Explorer
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time ledger audit events with state transition checks, CEI pull payment logs, and Merkle proofs.
                </p>
              </div>

              <AuditExplorer events={auditEvents} />
            </div>
          )}

          {/* VIEW: FACILITIES */}
          {currentView === "facilities" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Consortium Health Facilities & Telemetry
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Accredited hospitals, health centers, and rural health posts across Ethiopian regional states.
                  </p>
                </div>
                <button
                  onClick={() => setIsSyncModalOpen(true)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Trigger Starlink Satellite Sync
                </button>
              </div>

              <FacilityActivityPanel
                facilities={facilities}
                onTriggerSync={() => setIsSyncModalOpen(true)}
              />
            </div>
          )}

          {/* VIEW: EPHI DRUG PROCUREMENT AUCTIONS */}
          {currentView === "auctions" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    EPHI Pharmaceutical Reverse Procurement Auctions
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Solidity Contract: <code className="font-mono text-teal-600">createSupplyReverseAuction()</code> & <code className="font-mono text-teal-600">placeSupplyBid()</code> (Phase IV, Project 15).
                  </p>
                </div>
                <button
                  onClick={() => setIsAuctionModalOpen(true)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center"
                >
                  <Gavel className="w-3.5 h-3.5 mr-1.5" /> Place Descending Bid
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {auctions.map((auc) => (
                  <div
                    key={auc.auctionId}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {auc.itemDescription}
                      </span>
                      <StatusBadge variant="verified" label={auc.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Maximum Budget:</span>
                        <span className="font-bold">{auc.maxBudgetETB.toLocaleString()} eETB</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Current Lowest Bid:</span>
                        <span className="font-bold text-teal-600 dark:text-teal-400">
                          {auc.currentLowestBidETB.toLocaleString()} eETB
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px]">Leading Supplier:</span>
                        <span className="font-sans font-semibold text-slate-700 dark:text-slate-300">
                          {auc.winningSupplier}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Bids Placed: {auc.bidsCount}</span>
                      <span>Target Region: {auc.targetRegion}</span>
                      <span>Closes: {auc.endTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: SETTINGS */}
          {currentView === "settings" && (
            <div className="max-w-3xl space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Consortium Governance & Smart Contract Parameters
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  UUPS proxy configuration and ERC-7201 namespaced storage parameters.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Active Core Addresses</h3>
                <div className="font-mono space-y-2 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div><strong>DHRSCore Proxy:</strong> 0x391E5B4B2794c9f18B50478e1b6B79D206a25b16</div>
                  <div><strong>Soulbound DID SBT:</strong> 0x892a0149A5F19277fC31A76a59F12b32525F34E2</div>
                  <div><strong>ERC-1155 Records:</strong> 0x5FbDB2315678afecb367f032d93F642f64180aa3</div>
                  <div><strong>CBHI Settlement eETB:</strong> 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512</div>
                  <div><strong>ERC-7201 Slot:</strong> 0x8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd100</div>
                </div>

                <div className="pt-2">
                  <h4 className="font-bold text-sm mb-1 text-slate-900 dark:text-white">Pausable Circuit Breaker</h4>
                  <p className="text-slate-500 mb-3">
                    Governed by <code className="font-mono">CONSORTIUM_GOVERNOR_ROLE</code> (FMoH / EPHI). Halts non-essential operations in emergency without locking patient withdrawal balances.
                  </p>
                  <button className="px-4 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 font-semibold">
                    Simulate Protocol Emergency Pause
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODALS & DRAWERS */}
      <PatientDetailDrawer
        patient={selectedPatient}
        isOpen={Boolean(selectedPatient)}
        onClose={() => setSelectedPatient(null)}
        userRole={userRole}
        onOpenConsultation={() => {
          setConsultationPatient(selectedPatient);
          setSelectedPatient(null);
        }}
        onOpenGrantConsent={() => {
          setConsentPatient(selectedPatient);
        }}
      />

      <GrantConsentModal
        isOpen={Boolean(consentPatient)}
        patient={consentPatient}
        onClose={() => setConsentPatient(null)}
        onConsentGranted={(event) => {
          setAuditEvents((prev) => [event, ...prev]);
          setBannerNotice("Time-locked consent ticket anchored on ledger.");
        }}
        walletAccount={walletAccount}
      />

      <EncounterConsultationModal
        isOpen={Boolean(consultationPatient)}
        patient={consultationPatient}
        onClose={() => setConsultationPatient(null)}
        onEncounterCreated={handleEncounterCreated}
      />

      <EmergencyBreakGlassModal
        isOpen={isBreakGlassOpen}
        onClose={() => setIsBreakGlassOpen(false)}
        onSuccess={handleBreakGlassSuccess}
      />

      <OfflineSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSuccess={handleSyncSuccess}
      />

      <AuctionProcurementModal
        isOpen={isAuctionModalOpen}
        onClose={() => setIsAuctionModalOpen(false)}
        auctions={auctions}
        onPlaceBid={handlePlaceBid}
      />

      <AuditEventDrawer
        event={selectedAuditEvent}
        isOpen={Boolean(selectedAuditEvent)}
        onClose={() => setSelectedAuditEvent(null)}
      />

      <SessionLockModal
        isLocked={isSessionLocked}
        onUnlock={() => setIsSessionLocked(false)}
        userRole={userRole}
      />
    </div>
  );
}
