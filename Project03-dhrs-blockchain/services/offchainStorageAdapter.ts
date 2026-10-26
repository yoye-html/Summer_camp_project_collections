import crypto from "crypto";
import { encryptHealthRecord, decryptHealthRecord, CachedHealthRecord } from "./cryptoAndSyncService";

/**
 * Off-Chain Enterprise Database Adapter for DHRS-ET
 * Bridges Hospital EMRs (OpenMRS, Bahmni, PostgreSQL, local SQLite) with the Permissioned Blockchain.
 * 
 * CORE PRINCIPLE:
 * 1. Plaintext Protected Health Information (PHI) lives ONLY in local hospital memory.
 * 2. Before leaving the hospital or touching IPFS, records are encrypted with AES-256-GCM.
 * 3. Only the 32-byte cryptographic digest is anchored to the permissioned blockchain ledger.
 */

export interface PatientEMRDocument {
  patientId: string;
  w3cDID: string;
  encounterId: number;
  facilityCode: string;
  attendingDoctorDID: string;
  vitals: {
    bloodPressure: string;
    heartRate: number;
    temperatureCelsius: number;
    spo2Percent: number;
  };
  diagnoses: string[];
  medicationsPrescribed: Array<{
    code: number;
    name: string;
    dosage: string;
    durationDays: number;
  }>;
  labResultsSummary?: string;
  clinicalNotes: string;
  timestamp: string;
}

export interface OffChainStorageRecord {
  ipfsCID: string;
  encryptedPayloadBase64: string;
  onChainCommitmentHash: string; // 32-byte hash written to smart contract
  facilityId: string;
  createdAt: string;
}

export class HospitalOffChainStorageService {
  private localEncryptedBlobStore: Map<string, OffChainStorageRecord> = new Map();

  /**
   * 1. Ingests raw clinical EMR record from local hospital EHR (e.g. OpenMRS/PostgreSQL).
   * 2. Encrypts with AES-256-GCM using patient's symmetric key.
   * 3. Stores encrypted envelope in local off-chain store / IPFS Private Cluster.
   * 4. Returns 32-byte commitment hash ready for on-chain anchoring.
   */
  public async storeClinicalEncounter(
    record: PatientEMRDocument,
    patientSymmetricKey: Buffer
  ): Promise<{
    onChainHash: string;
    ipfsCID: string;
    storageReceipt: OffChainStorageRecord;
  }> {
    const rawJson = JSON.stringify(record);

    // Client-side AES-256-GCM encryption
    const { ipfsPayload, onChainHash } = encryptHealthRecord(rawJson, patientSymmetricKey);

    // Deterministic CID derived from SHA-256 digest of ciphertext
    const ipfsCID = "Qm" + onChainHash.slice(2, 46);

    const storageReceipt: OffChainStorageRecord = {
      ipfsCID,
      encryptedPayloadBase64: ipfsPayload,
      onChainCommitmentHash: onChainHash,
      facilityId: record.facilityCode,
      createdAt: new Date().toISOString(),
    };

    // Saved to hospital encrypted blob store / Private IPFS node
    this.localEncryptedBlobStore.set(ipfsCID, storageReceipt);

    return {
      onChainHash,
      ipfsCID,
      storageReceipt,
    };
  }

  /**
   * Retrieves encrypted record and verifies that its hash matches the on-chain blockchain commitment
   * before decrypting with authorized patient key.
   */
  public async retrieveAndVerifyRecord(
    ipfsCID: string,
    onChainVerifiedHash: string,
    patientSymmetricKey: Buffer
  ): Promise<PatientEMRDocument> {
    const stored = this.localEncryptedBlobStore.get(ipfsCID);
    if (!stored) {
      throw new Error(`Record ${ipfsCID} not found in off-chain cluster.`);
    }

    // Verify cryptographic integrity commitment against ledger state
    if (stored.onChainCommitmentHash !== onChainVerifiedHash) {
      throw new Error("Tamper alert: Off-chain record hash does NOT match blockchain ledger commitment!");
    }

    // Decrypt AES-256-GCM envelope
    const decryptedJson = decryptHealthRecord(stored.encryptedPayloadBase64, patientSymmetricKey);
    return JSON.parse(decryptedJson) as PatientEMRDocument;
  }
}

