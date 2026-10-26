import { PatientRecord, UserRole } from "@/types";
import { hasPermission } from "./permissions";

/**
 * Sanitizes a cell to prevent CSV Formula Injection attacks.
 * If a value starts with '=', '+', '-', '@', '\t', or '\r', prefix with an apostrophe.
 */
export function sanitizeCSVValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Formula injection prevention
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r"];
  if (dangerousPrefixes.some((prefix) => str.startsWith(prefix))) {
    str = "'" + str;
  }

  // Escape double quotes and enclose in quotes
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Exports synthetic patient registry data respecting RBAC permissions and active filters.
 */
export function exportPatientRegistryCSV(
  patients: PatientRecord[],
  role: UserRole
): { filename: string; recordCount: number } {
  const canViewDemographics = hasPermission(role, "canViewDemographics");

  const headers = [
    "Patient ID",
    "W3C DID",
    "Full Name",
    "Age / Birth Year",
    "Gender",
    "Region",
    "Kebele",
    "SmartCard UID",
    "Biometric Anchor Hash",
    "Record Status",
    "Encounters Count",
    "Last Updated",
  ];

  const rows = patients.map((p) => {
    return [
      sanitizeCSVValue(p.id),
      sanitizeCSVValue(p.w3cDID),
      // Privacy preservation for auditors / unauthorized roles
      sanitizeCSVValue(canViewDemographics ? p.fullName : "[ANONYMIZED_CITIZEN]"),
      sanitizeCSVValue(canViewDemographics ? p.birthYear : "[HIDDEN]"),
      sanitizeCSVValue(p.gender),
      sanitizeCSVValue(p.region),
      sanitizeCSVValue(canViewDemographics ? p.kebele : "[HIDDEN]"),
      sanitizeCSVValue(p.smartCardUid),
      sanitizeCSVValue(p.biometricAnchorHash),
      sanitizeCSVValue(p.status),
      sanitizeCSVValue(p.encounters.length),
      sanitizeCSVValue(p.lastUpdated),
    ].join(",");
  });

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const filename = `dhrs_et_patients_export_${new Date().toISOString().slice(0, 10)}.csv`;
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return { filename, recordCount: patients.length };
}

