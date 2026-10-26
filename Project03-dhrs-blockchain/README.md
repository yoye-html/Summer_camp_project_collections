# DHRS-ET: Decentralized Health Record System (Ethiopia)
### Production-Grade Enterprise Smart Contract Suite & Frontier Healthcare Dashboard

**Consortium Authority:** Federal Democratic Republic of Ethiopia Ministry of Health (FMoH), Ethiopian Public Health Institute (EPHI), and Regional Health Bureaus (RHBs).  
**Consortium Blockchain:** Enterprise Permissioned EVM Blockchain (Hyperledger Besu / Polygon Edge) using QBFT / IBFT 2.0 Consensus.  
**Frontend Framework:** React 19 + TypeScript + Vite + Tailwind CSS + Ethers.js + Web Crypto API.

---

## 1. Executive Architecture Overview

DHRS-ET solves the foundational challenges of national electronic health records in Ethiopia:
1. **Zero Plaintext Health Information On-Chain or on Public IPFS:**
   All clinical encounter data is encrypted client-side using **AES-256-GCM** before pinning to IPFS. Only 32-byte cryptographic digests (`bytes32`) and Merkle roots are anchored on the blockchain.
2. **Biometric Citizen Soulbound Identity (`ERC-721`):**
   Non-transferable Soulbound Token (`DHRSPatientIdentitySBT`) bound to citizen W3C DIDs and ISO 7816 smart card biometric template hashes.
3. **Multi-Token Clinical Records & Electronic Prescriptions (`ERC-1155`):**
   Distinguishes non-fungible diagnostic episodes from semi-fungible refillable electronic prescriptions (`DHRSRecordsERC1155`) with pharmacy dispense/burn mechanics.
4. **CBHI Settlement Birr Pool (`ERC-20` / `eETB`):**
   Community-Based Health Insurance claims settled via **Pull-over-Push payments** with Checks-Effects-Interactions (CEI) and `ReentrancyGuardUpgradeable` protection.
5. **2-of-3 Multi-Sig Emergency Break-Glass Protocol:**
   Unconscious trauma patients arriving at emergency wards can be accessed when 2 licensed physicians co-sign within a 1-hour window, granting strictly 24-hour access with an indelible ledger audit trail.
6. **Offline-First SQLite Merkle Diff Synchronization:**
   Engineered for the 40% of rural Ethiopian health posts with intermittent connectivity. Encounters are cached locally in SQLite; when Starlink or 3G reconnects, a double-hashed Merkle tree is computed and anchored on-chain in a single transaction.
7. **EPHI Pharmaceutical Reverse Procurement Auctions:**
   Competitive reverse Dutch auctions where pharmaceutical suppliers bid downwards below maximum budgets to alleviate regional drug shortages (e.g., Rifampicin TB regimens, Artemether malaria blister packs).
8. **UUPS Proxy + ERC-7201 Namespaced Storage:**
   Guarantees zero storage slot collisions across ministerial upgrades via slot `0x8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd100`.

---

## 2. Smart Contract Architecture

The contracts live in [`contracts/`](./contracts/):

| File | Standard | Purpose |
| :--- | :--- | :--- |
| [`InterfacesAndLibraries.sol`](./contracts/InterfacesAndLibraries.sol) | Interfaces & Errors | Custom gas-efficient errors (`IDHRSErrors`), `IDHRSPatientDID`, `IDHRSRecordsERC1155`. |
| [`DHRSPatientIdentitySBT.sol`](./contracts/DHRSPatientIdentitySBT.sol) | `ERC-721` + `AccessControl` | W3C DID & ISO 7816 smart card identity. Reverts transfers with `SoulboundTokenNonTransferable`. |
| [`DHRSRecordsERC1155.sol`](./contracts/DHRSRecordsERC1155.sol) | `ERC-1155` + `AccessControl` | Clinical record NFTs and dispensable electronic prescriptions SFTs with expiration tracking. |
| [`CBHIPaymentToken.sol`](./contracts/CBHIPaymentToken.sol) | `ERC-20` + `AccessControl` | Digital Ethiopian Birr (`eETB`) with ministerial treasury minting roles. |
| [`DHRSCoreUpgradeable.sol`](./contracts/DHRSCoreUpgradeable.sol) | UUPS + `ERC-7201` + FSM | Core engine managing encounters FSM, 2-of-3 break-glass, Merkle sync, CBHI claims pull-payment, and reverse auctions. |

---

## 3. Frontend Architecture & Features

The dashboard lives in [`src/`](./src/):

- **Interactive Overview Dashboard:**
  - Real-time operational metrics (Registered citizens, encounters today, connected facilities, pending Merkle sync, CBHI pull-payment escrow).
  - Time-series activity chart with Day, Week, and Month filters.
  - Facility connectivity monitor with regional breakdown and Starlink sync triggers.
  - Recent audit events table.
  - Telemetry and zero-knowledge status panel.
- **Patient Registry Workspace:**
  - Fast search by patient name, ID, W3C DID, or region.
  - Regional filtering (Addis Ababa, Oromia, Amhara, Tigray, Sidama, etc.) and record status.
  - Multi-column sorting, pagination, and row inspection.
  - **Sanitized CSV export** with formula-injection mitigation (`=`, `+`, `-`, `@` leading character escaping).
- **8-Tab Comprehensive Patient Detail Drawer:**
  - Tabs: Overview, Medical History, Encounters, Medications & Prescriptions, Allergies & Critical Alerts, Encrypted IPFS Documents, Blockchain Provenance Timeline, and Time-Locked Consent Tickets.
- **Clinical Encounter Consultation Modal:**
  - Active consent verification.
  - Clinical examination notes input.
  - **In-Browser Client-Side AES-256-GCM Encryption** (Web Crypto API).
  - On-chain digest anchoring (`EncounterState.RecordAnchored`).
  - Electronic prescription issuance (`ERC-1155`).
  - CBHI claim submission (`eETB`).
- **2-of-3 Multi-Sig Emergency Break-Glass Modal:**
  - 2-physician co-signing flow for trauma emergencies.
  - Immutable audit event broadcast to ledger.
- **Rural Kebele Health Post Merkle Sync Modal:**
  - In-browser double-hashed Merkle tree generator.
  - Proof computation and on-chain verification simulation.
- **EPHI Pharmaceutical Reverse Procurement Modal:**
  - Descending bid broadcast for active regional drug shortages.
- **Audit & Compliance Explorer:**
  - Complete block height, transaction hash, actor address, and integrity proof inspection.
- **Security & Session Lock:**
  - Inactivity and manual session lock screen hiding sensitive PHI behind an opaque backdrop with PIN unlock.

---

## 4. Setup, Development & Build Instructions

### Prerequisites
- Node.js `v20+`
- npm `10+`

### Installation
```bash
npm install
```

### Run Local Development Server
```bash
npm run dev
```
The dashboard will be available at `http://localhost:3000`.

### Production Build & Typecheck
```bash
npm run build
```
Generates the optimized static bundle in `dist/`.

### Run Smart Contract Foundry Tests
```bash
forge test -vvv
```

---

## 5. Demonstration Roles & Permissions Matrix

Use the role-switcher dropdown in the top application bar to test role-based access control:

| Permission | Clinician (Doctor) | Data Auditor | Facility Administrator | System Administrator (FMoH) |
| :--- | :---: | :---: | :---: | :---: |
| **View Demographics** | Yes | Anonymized | Yes | Yes |
| **View Medical History** | Yes | No | No | Yes |
| **Anchor Encrypted Records** | Yes | No | No | Yes |
| **Issue E-Prescriptions** | Yes | No | No | Yes |
| **2-of-3 Break-Glass Protocol** | Yes | No | No | Yes |
| **Audit Explorer & Provenance** | No | Yes | No | Yes |
| **Trigger Merkle Sync** | No | No | Yes | Yes |
| **CBHI Pull Payment Withdrawal** | No | No | Yes | Yes |
| **Manage Drug Auctions** | No | Yes | No | Yes |
| **Export Sanitized CSV** | Yes | Yes (Anonymized) | Yes | Yes |

