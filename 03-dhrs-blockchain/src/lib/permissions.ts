import { UserRole } from "@/types";

export interface RolePermissions {
  canViewDemographics: boolean;
  canViewMedicalHistory: boolean;
  canAnchorRecords: boolean;
  canIssuePrescriptions: boolean;
  canInitiateBreakGlass: boolean;
  canAuditLedger: boolean;
  canManageFacilities: boolean;
  canSubmitCBHIClaims: boolean;
  canAdjudicateCBHIClaims: boolean;
  canWithdrawPullPayments: boolean;
  canManageAuctions: boolean;
  canSyncOfflineBatches: boolean;
  canExportCSV: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  clinician: {
    canViewDemographics: true,
    canViewMedicalHistory: true,
    canAnchorRecords: true,
    canIssuePrescriptions: true,
    canInitiateBreakGlass: true,
    canAuditLedger: false,
    canManageFacilities: false,
    canSubmitCBHIClaims: false,
    canAdjudicateCBHIClaims: false,
    canWithdrawPullPayments: false,
    canManageAuctions: false,
    canSyncOfflineBatches: false,
    canExportCSV: true,
  },
  auditor: {
    canViewDemographics: false, // Privacy-preserved anonymized placeholders
    canViewMedicalHistory: false,
    canAnchorRecords: false,
    canIssuePrescriptions: false,
    canInitiateBreakGlass: false,
    canAuditLedger: true,
    canManageFacilities: true,
    canSubmitCBHIClaims: false,
    canAdjudicateCBHIClaims: true,
    canWithdrawPullPayments: false,
    canManageAuctions: true,
    canSyncOfflineBatches: false,
    canExportCSV: true,
  },
  facility_admin: {
    canViewDemographics: true,
    canViewMedicalHistory: false,
    canAnchorRecords: false,
    canIssuePrescriptions: false,
    canInitiateBreakGlass: false,
    canAuditLedger: false,
    canManageFacilities: true,
    canSubmitCBHIClaims: true,
    canAdjudicateCBHIClaims: false,
    canWithdrawPullPayments: true,
    canManageAuctions: false,
    canSyncOfflineBatches: true,
    canExportCSV: true,
  },
  system_admin: {
    canViewDemographics: true,
    canViewMedicalHistory: true,
    canAnchorRecords: true,
    canIssuePrescriptions: true,
    canInitiateBreakGlass: true,
    canAuditLedger: true,
    canManageFacilities: true,
    canSubmitCBHIClaims: true,
    canAdjudicateCBHIClaims: true,
    canWithdrawPullPayments: true,
    canManageAuctions: true,
    canSyncOfflineBatches: true,
    canExportCSV: true,
  },
};

export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

