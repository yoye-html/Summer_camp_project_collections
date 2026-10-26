/**
 * Offline-first Merkle Tree Generator for Rural Ethiopian Health Posts
 * Compatible with OpenZeppelin MerkleProof.sol and DHRSCoreUpgradeable.syncOfflineFacilityRecords
 */

export interface OfflineRecordItem {
  patientAddress: string;
  recordHash: string; // 32-byte hex string
}

export interface MerkleSyncPayload {
  merkleRoot: string;
  patients: string[];
  recordHashes: string[];
  merkleProofs: string[][];
}

async function sha256(buffer: Uint8Array): Promise<Uint8Array> {
  const digest = await window.crypto.subtle.digest("SHA-256", buffer as unknown as BufferSource);
  return new Uint8Array(digest);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const arr = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    arr[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashLeaf(patient: string, recordHash: string): Promise<Uint8Array> {
  const cleanPatient = patient.toLowerCase().replace("0x", "").padStart(64, "0");
  const cleanHash = recordHash.toLowerCase().replace("0x", "").padStart(64, "0");
  const encoded = hexToBytes(cleanPatient + cleanHash);

  // Double-hash to prevent second-preimage attack
  const inner = await sha256(encoded);
  return await sha256(inner);
}

export async function buildMerkleTree(records: OfflineRecordItem[]): Promise<MerkleSyncPayload> {
  if (records.length === 0) {
    return {
      merkleRoot: "0x" + "0".repeat(64),
      patients: [],
      recordHashes: [],
      merkleProofs: [],
    };
  }

  const leaves: Uint8Array[] = [];
  for (const r of records) {
    leaves.push(await hashLeaf(r.patientAddress, r.recordHash));
  }

  const layers: Uint8Array[][] = [leaves];
  let currentLayer = leaves;

  while (currentLayer.length > 1) {
    const nextLayer: Uint8Array[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        const left = currentLayer[i];
        const right = currentLayer[i + 1];
        // Lexicographical sorting
        let combined: Uint8Array;
        if (bytesToHex(left) <= bytesToHex(right)) {
          combined = new Uint8Array(left.length + right.length);
          combined.set(left, 0);
          combined.set(right, left.length);
        } else {
          combined = new Uint8Array(right.length + left.length);
          combined.set(right, 0);
          combined.set(left, right.length);
        }
        nextLayer.push(await sha256(combined));
      } else {
        nextLayer.push(currentLayer[i]);
      }
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  const root = bytesToHex(layers[layers.length - 1][0]);

  // Generate proofs for each leaf
  const proofs: string[][] = [];
  for (let idx = 0; idx < records.length; idx++) {
    const proof: string[] = [];
    let currentIdx = idx;
    for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
      const layer = layers[layerIdx];
      const isRight = currentIdx % 2 === 1;
      const pairIdx = isRight ? currentIdx - 1 : currentIdx + 1;
      if (pairIdx < layer.length) {
        proof.push(bytesToHex(layer[pairIdx]));
      }
      currentIdx = Math.floor(currentIdx / 2);
    }
    proofs.push(proof);
  }

  return {
    merkleRoot: root,
    patients: records.map((r) => r.patientAddress),
    recordHashes: records.map((r) => r.recordHash),
    merkleProofs: proofs,
  };
}
