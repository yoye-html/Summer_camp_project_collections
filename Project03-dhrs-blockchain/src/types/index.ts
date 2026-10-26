// TypeScript Definitions for DHRS-ET

export type UserRole = "clinician" | "auditor" | "facility_admin" | "system_admin";

export type EthiopianRegion =
  | "ET-AA" // Addis Ababa
  | "ET-OR" // Oromia
  | "ET-AM" // Amhara
  | "ET-TI" // Tigray
  | "ET-SN" // Sidama
  | "ET-SO" // Somali
  | "ET-AF" // Afar
  | "ET-BE" // Benishangul-Gumuz
  | "ET-GA" // Gambela
  | "ET-HA" // Harari
  | "ET-SW"; // South West

export enum EncounterState {
  None = 0,
  ConsentGranted = 1,
  ConsultationActive = 2,
  RecordAnchored = 3,
  ClaimSubmitted = 4,
  ClaimAdjudicated = 5,
  Settled = 6,
}

export interface ConsentTicket {
  grantedAt: number;
  expiresAt: number;
  isEmergencyBreakGlass: boolean;
  physicianAddress: string;
}

export interface ClinicalEncounter {
  encounterId: number;
  patientId: string;
  facilityId: string;
  facilityName: string;
  attendingPhysician: string;
  physicianName: string;
  state: EncounterState;
  diagnosis: string;
  ipfsCid: string;
  onChainHash: string;
  claimAmountETB: number;
  createdAt: string;
  updatedAt: string;
}

export interface ElectronicPrescription {
  prescriptionId: string;
  encounterId: number;
  medicationName: string;
  medicationCode: number;
  dosage: string;
  quantity: number;
  remainingQuantity: number;
  validUntil: string;
  dispensed: boolean;
  dispensedAt?: string;
  pharmacyName?: string;
}

export interface PatientRecord {
  id: string; // e.g. "ET-DID-082491"
  w3cDID: string; // "did:ethr:et:0x..."
  fullName: string;
  birthYear: number;
  gender: "Male" | "Female";
  region: EthiopianRegion;
  kebele: string;
  smartCardUid: string;
  biometricAnchorHash: string;
  status: "Verified Active" | "Emergency Override" | "Inactive";
  bloodType: string;
  allergies: string[];
  chronicConditions: string[];
  encounters: ClinicalEncounter[];
  prescriptions: ElectronicPrescription[];
  lastUpdated: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType:
    | "PATIENT_ENROLLED"
    | "CONSENT_GRANTED"
    | "CONSULTATION_OPENED"
    | "RECORD_ANCHORED"
    | "EMERGENCY_BREAK_GLASS"
    | "OFFLINE_MERKLE_SYNC"
    | "CBHI_CLAIM_SUBMITTED"
    | "CLAIM_ADJUDICATED"
    | "PULL_PAYMENT_WITHDRAWN"
    | "AUCTION_BID_PLACED";
  recordReference: string;
  actorAddress: string;
  actorRole: string;
  facility: string;
  verificationStatus: "Confirmed on Ledger" | "Pending Block" | "Failed Verification";
  txHash: string;
  blockNumber: number;
  details: string;
  integrityProofValid: boolean;
}

export interface Facility {
  id: string;
  name: string;
  type: "Referral Hospital" | "General Hospital" | "Health Center" | "Rural Health Post";
  region: EthiopianRegion;
  zone: string;
  woreda: string;
  connectivityStatus: "Online (Fiber/4G)" | "Intermittent (Starlink)" | "Offline Mode";
  lastSyncTimestamp: string;
  pendingSyncQueue: number;
  accreditedPhysiciansCount: number;
  cbhiPendingReimbursementETB: number;
}

export interface ReverseAuction {
  auctionId: number;
  itemDescription: string;
  targetRegion: EthiopianRegion;
  maxBudgetETB: number;
  currentLowestBidETB: number;
  winningSupplier: string;
  endTime: string;
  status: "Active" | "Finalized" | "Cancelled";
  bidsCount: number;
}

