import React, { useState, useMemo } from "react";
import {
  Search,
  Download,
  Filter,
  ArrowUpDown,
  Eye,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { PatientRecord, UserRole, EthiopianRegion } from "@/types";
import { StatusBadge } from "../shared/StatusBadge";
import { exportPatientRegistryCSV } from "@/lib/csvExport";
import { hasPermission } from "@/lib/permissions";

interface PatientRegistryTableProps {
  patients: PatientRecord[];
  onSelectPatient: (patient: PatientRecord) => void;
  onOpenConsultation: (patient: PatientRecord) => void;
  userRole: UserRole;
}

export const PatientRegistryTable: React.FC<PatientRegistryTableProps> = ({
  patients,
  onSelectPatient,
  onOpenConsultation,
  userRole,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [sortField, setSortField] = useState<keyof PatientRecord>("lastUpdated");
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const canViewDemographics = hasPermission(userRole, "canViewDemographics");
  const canAnchorRecords = hasPermission(userRole, "canAnchorRecords");
  const canExportCSV = hasPermission(userRole, "canExportCSV");

  // Filtering
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.w3cDID.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.region.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRegion = selectedRegion === "ALL" || p.region === selectedRegion;
      const matchesStatus = selectedStatus === "ALL" || p.status === selectedStatus;

      return matchesSearch && matchesRegion && matchesStatus;
    });
  }, [patients, searchQuery, selectedRegion, selectedStatus]);

  // Sorting
  const sortedPatients = useMemo(() => {
    return [...filteredPatients].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredPatients, sortField, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(sortedPatients.length / pageSize) || 1;
  const paginatedPatients = sortedPatients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (field: keyof PatientRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExport = () => {
    exportPatientRegistryCSV(filteredPatients, userRole);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Control Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Name, Patient ID, W3C DID, or Region..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center space-x-2.5">
          <select
            value={selectedRegion}
            onChange={(e) => {
              setSelectedRegion(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Ethiopian Regions</option>
            <option value="ET-AA">Addis Ababa (ET-AA)</option>
            <option value="ET-OR">Oromia (ET-OR)</option>
            <option value="ET-AM">Amhara (ET-AM)</option>
            <option value="ET-TI">Tigray (ET-TI)</option>
            <option value="ET-SN">Sidama (ET-SN)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:outline-none text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">All Statuses</option>
            <option value="Verified Active">Verified Active</option>
            <option value="Emergency Override">Emergency Override</option>
          </select>

          {canExportCSV && (
            <button
              onClick={handleExport}
              title="Export sanitized CSV with formula-injection protection"
              className="flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/60 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="py-3 px-4 font-semibold">
                <button
                  onClick={() => handleSort("id")}
                  className="flex items-center space-x-1 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  <span>Patient ID</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4 font-semibold">
                <button
                  onClick={() => handleSort("fullName")}
                  className="flex items-center space-x-1 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  <span>Full Name (Citizen)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-4 font-semibold">Region & Kebele</th>
              <th className="py-3 px-4 font-semibold">Blood Group</th>
              <th className="py-3 px-4 font-semibold">Record Status</th>
              <th className="py-3 px-4 font-semibold">Encounters</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {paginatedPatients.length > 0 ? (
              paginatedPatients.map((patient) => (
                <tr
                  key={patient.id}
                  className="hover:bg-teal-50/30 dark:hover:bg-teal-950/10 transition-colors group"
                >
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                    {patient.id}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                    {canViewDemographics ? patient.fullName : (
                      <span className="text-slate-400 italic">[ANONYMIZED_CITIZEN]</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">{patient.region}</span> • {canViewDemographics ? patient.kebele : "[Kebele Hidden]"}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-red-600 dark:text-red-400">
                    {patient.bloodType}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge
                      variant={
                        patient.status === "Verified Active"
                          ? "verified"
                          : patient.status === "Emergency Override"
                          ? "critical"
                          : "neutral"
                      }
                      label={patient.status}
                    />
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">
                    {patient.encounters.length} anchored
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      onClick={() => onSelectPatient(patient)}
                      className="p-1.5 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Inspect in Detail Drawer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canAnchorRecords && (
                      <button
                        onClick={() => onOpenConsultation(patient)}
                        className="px-2.5 py-1 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg shadow-sm transition-colors"
                        title="Start Encounter"
                      >
                        Encounter
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  No patient records match the active search criteria or filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50 dark:bg-slate-800/40">
        <span>
          Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedPatients.length)} of {sortedPatients.length} records
        </span>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

