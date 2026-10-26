// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./InterfacesAndLibraries.sol";

/**
 * @title DHRSCoreUpgradeable
 * @author Ethiopian Digital Health Records Consortium (FMoH / EPHI / RHBs)
 * @notice Enterprise Core Engine for DHRS-ET. Implements:
 *         - Phase I: Strict Finite State Machine (Clinical Encounter & CBHI Lifecycle) + Time-locked consent
 *         - Phase II: ERC-20 (CBHI eETB), ERC-721 (DID SBT), and ERC-1155 (Clinical Records & Prescriptions)
 *         - Phase III: RBAC, 2-of-3 Multi-Sig Emergency Break-Glass, CEI + nonReentrant, Offline Merkle Diff Sync
 *         - Phase IV: UUPS Proxy + ERC-7201 Namespaced Storage, Pull-over-Push Payments, Reverse Dutch Procurement Auctions
 */
contract DHRSCoreUpgradeable is 
    Initializable, 
    UUPSUpgradeable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable,
    IDHRSErrors 
{
    using SafeERC20 for IERC20;

    // =============================================================
    //                           ROLES
    // =============================================================
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant CONSORTIUM_GOVERNOR_ROLE = keccak256("CONSORTIUM_GOVERNOR_ROLE"); // FMoH, EPHI, RHBs
    bytes32 public constant HEALTH_FACILITY_ROLE = keccak256("HEALTH_FACILITY_ROLE");         // Accredited Hospitals / Clinics
    bytes32 public constant PHYSICIAN_ROLE = keccak256("PHYSICIAN_ROLE");                     // Licensed Doctors

    // =============================================================
    //                  STATE MACHINE DEFINITIONS
    // =============================================================
    enum EncounterState {
        None,               // 0: Initial uninitialized state
        ConsentGranted,     // 1: Patient tapped smart card or signed via mobile app
        ConsultationActive, // 2: Physician checked credentials and opened session
        RecordAnchored,     // 3: AES-256 encrypted IPFS CID anchored on-chain
        ClaimSubmitted,     // 4: Facility submitted CBHI reimbursement claim
        ClaimAdjudicated,   // 5: Consortium auditor verified clinical history
        Settled             // 6: Funds credited to facility's pull payment escrow
    }

    enum AuctionState {
        Inactive,
        Active,
        Finalized,
        Cancelled
    }

    struct ConsentTicket {
        uint64 grantedAt;
        uint64 expiresAt;      // e.g., +24 hours for emergency, +180 days for chronic care
        bool isEmergencyBreakGlass;
    }

    struct ClinicalEncounter {
        uint256 encounterId;
        address patient;
        address facility;
        address attendingPhysician;
        EncounterState state;
        bytes32 ipfsCidHash;   // SHA-256 / Keccak256 of AES-256-GCM encrypted IPFS record
        uint256 claimAmount;   // In CBHI eETB settlement tokens
        uint64 updatedAt;
    }

    struct EmergencyOverrideRequest {
        address patient;
        address targetPhysician;
        uint64 createdAt;
        uint8 approvalCount;
        bool executed;
        mapping(address => bool) approvals;
    }

    struct ProcurementAuction {
        string itemDescription; // e.g., "100,000 Rifampicin TB Packs for Jimma Zone"
        uint256 maxBudget;
        uint256 lowestBid;
        address winningSupplier;
        uint64 endTime;
        AuctionState state;
    }

    // =============================================================
    //           ERC-7201 NAMESPACED STORAGE LAYOUT (PROXY SAFE)
    // =============================================================
    /// @custom:storage-location erc7201:dhrs.et.storage.Main
    struct DHRSStorage {
        IDHRSPatientDID patientIdentityContract;
        IDHRSRecordsERC1155 recordsContract;
        IERC20 cbhiPaymentToken; // Digital Birr (eETB)
        uint256 encounterCounter;
        uint256 emergencyRequestCounter;
        uint256 auctionCounter;

        // Patient => Physician/Facility => Consent
        mapping(address => mapping(address => ConsentTicket)) consents;
        // Encounter ID => ClinicalEncounter
        mapping(uint256 => ClinicalEncounter) encounters;
        // Patient => Array of IPFS Record Hashes
        mapping(address => bytes32[]) patientMedicalHistory;
        // Facility => Merkle Root for Offline SQLite Sync (40% rural clinics)
        mapping(address => bytes32) facilityOfflineMerkleRoots;
        // Emergency Break-Glass ID => Request
        mapping(uint256 => EmergencyOverrideRequest) emergencyRequests;
        // Pull Payment Escrow: Facility/Supplier => Claimable eETB Balance
        mapping(address => uint256) pendingPullPayments;
        // Auction ID => ProcurementAuction
        mapping(uint256 => ProcurementAuction) auctions;
    }

    // keccak256(abi.encode(uint256(keccak256("dhrs.et.storage.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant DHRS_STORAGE_LOCATION = 
        0x8a35acfbc15ff81a39ae7d344fd709f28e8600b4aa8c65c6b64bfe7fe36bd100;

    function _getStorage() private pure returns (DHRSStorage storage $) {
        assembly {
            $.slot := DHRS_STORAGE_LOCATION
        }
    }

    // =============================================================
    //                    EVENTS (AUDIT TRAIL)
    // =============================================================
    event ConsentUpdated(address indexed patient, address indexed provider, uint64 expiresAt, bool isEmergency);
    event ConsentRevoked(address indexed patient, address indexed provider, uint64 timestamp);
    event EncounterStateChanged(uint256 indexed encounterId, EncounterState indexed oldState, EncounterState indexed newState, uint64 timestamp);
    event MedicalRecordAnchored(address indexed patient, address indexed physician, uint256 indexed encounterId, bytes32 ipfsCidHash);
    event EmergencyBreakGlassInitiated(uint256 indexed requestId, address indexed patient, address indexed initiator);
    event EmergencyBreakGlassApproved(uint256 indexed requestId, address indexed approver, uint8 totalApprovals);
    event EmergencyBreakGlassExecuted(uint256 indexed requestId, address indexed patient, address indexed physician, uint64 expiresAt);
    event OfflineBatchSynced(address indexed facility, bytes32 oldMerkleRoot, bytes32 newMerkleRoot, uint256 recordsSynced);
    event TreasuryDeposit(address indexed funder, uint256 amount);
    event PullPaymentCredited(address indexed beneficiary, uint256 amount);
    event PullPaymentWithdrawn(address indexed beneficiary, uint256 amount);
    event ReverseAuctionCreated(uint256 indexed auctionId, string itemDescription, uint256 maxBudget, uint64 endTime);
    event NewLowestBid(uint256 indexed auctionId, address indexed supplier, uint256 bidAmount);
    event ReverseAuctionFinalized(uint256 indexed auctionId, address indexed winningSupplier, uint256 finalPrice);
    event ReverseAuctionCancelled(uint256 indexed auctionId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Proxy initializer setting consortium governance and core contracts.
     */
    function initialize(
        address admin,
        address _patientIdentityContract,
        address _recordsContract,
        address _cbhiPaymentToken
    ) public initializer {
        if (admin == address(0) || _patientIdentityContract == address(0) || _cbhiPaymentToken == address(0)) {
            revert ZeroAddressNotAllowed();
        }

        __UUPSUpgradeable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(CONSORTIUM_GOVERNOR_ROLE, admin);

        DHRSStorage storage $ = _getStorage();
        $.patientIdentityContract = IDHRSPatientDID(_patientIdentityContract);
        if (_recordsContract != address(0)) {
            $.recordsContract = IDHRSRecordsERC1155(_recordsContract);
        }
        $.cbhiPaymentToken = IERC20(_cbhiPaymentToken);
    }

    // =============================================================
    //        1. CORE MECHANICS, CONSENT & STATE MACHINE
    // =============================================================

    /**
     * @notice Patient grants time-bound read/write consent to a physician (via Smart Card tap or App).
     *         Adheres to Phase I (Project 1: Time Lock & Project 3: State Machine).
     */
    function grantConsent(address physician, uint64 durationSeconds) external whenNotPaused returns (uint256) {
        if (durationSeconds == 0) revert InvalidParameters();
        DHRSStorage storage $ = _getStorage();
        if (!$.patientIdentityContract.verifyPatient(msg.sender)) revert UnauthorizedAccess(msg.sender);
        if (!hasRole(PHYSICIAN_ROLE, physician)) revert UnauthorizedAccess(physician);

        uint64 expiresAt = uint64(block.timestamp) + durationSeconds;
        $.consents[msg.sender][physician] = ConsentTicket({
            grantedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            isEmergencyBreakGlass: false
        });

        uint256 encounterId = ++$.encounterCounter;
        $.encounters[encounterId] = ClinicalEncounter({
            encounterId: encounterId,
            patient: msg.sender,
            facility: address(0),
            attendingPhysician: physician,
            state: EncounterState.ConsentGranted,
            ipfsCidHash: bytes32(0),
            claimAmount: 0,
            updatedAt: uint64(block.timestamp)
        });

        emit ConsentUpdated(msg.sender, physician, expiresAt, false);
        emit EncounterStateChanged(encounterId, EncounterState.None, EncounterState.ConsentGranted, uint64(block.timestamp));
        return encounterId;
    }

    /**
     * @notice Patient explicitly revokes consent before expiration (Data Sovereignty).
     */
    function revokeConsent(address physician) external whenNotPaused {
        DHRSStorage storage $ = _getStorage();
        delete $.consents[msg.sender][physician];
        emit ConsentRevoked(msg.sender, physician, uint64(block.timestamp));
    }

    /**
     * @notice Physician starts consultation & transitions state machine: ConsentGranted -> ConsultationActive
     */
    function startConsultation(uint256 encounterId, address facility) external onlyRole(PHYSICIAN_ROLE) whenNotPaused {
        DHRSStorage storage $ = _getStorage();
        ClinicalEncounter storage enc = $.encounters[encounterId];

        if (enc.attendingPhysician != msg.sender) revert UnauthorizedAccess(msg.sender);
        if (!hasRole(HEALTH_FACILITY_ROLE, facility)) revert UnauthorizedAccess(facility);
        _validateState(enc.state, EncounterState.ConsentGranted);
        _verifyActiveConsent($, enc.patient, msg.sender);

        enc.facility = facility;
        _transitionState(enc, EncounterState.ConsultationActive);
    }

    /**
     * @notice Physician anchors AES-256-GCM encrypted IPFS hash: ConsultationActive -> RecordAnchored
     *         Mints medical record NFT via ERC-1155 if contract is configured.
     */
    function anchorEncryptedRecord(uint256 encounterId, bytes32 ipfsCidHash) external onlyRole(PHYSICIAN_ROLE) whenNotPaused {
        if (ipfsCidHash == bytes32(0)) revert InvalidParameters();
        DHRSStorage storage $ = _getStorage();
        ClinicalEncounter storage enc = $.encounters[encounterId];

        if (enc.attendingPhysician != msg.sender) revert UnauthorizedAccess(msg.sender);
        _validateState(enc.state, EncounterState.ConsultationActive);
        _verifyActiveConsent($, enc.patient, msg.sender);

        enc.ipfsCidHash = ipfsCidHash;
        $.patientMedicalHistory[enc.patient].push(ipfsCidHash);

        if (address($.recordsContract) != address(0)) {
            $.recordsContract.mintClinicalRecord(enc.patient, ipfsCidHash, msg.sender);
        }

        _transitionState(enc, EncounterState.RecordAnchored);
        emit MedicalRecordAnchored(enc.patient, msg.sender, encounterId, ipfsCidHash);
    }

    /**
     * @notice Physician issues an electronic prescription during active consultation.
     */
    function issuePrescription(
        uint256 encounterId,
        uint256 medicationCode,
        uint256 quantity,
        uint64 validUntil
    ) external onlyRole(PHYSICIAN_ROLE) whenNotPaused returns (uint256) {
        DHRSStorage storage $ = _getStorage();
        ClinicalEncounter storage enc = $.encounters[encounterId];

        if (enc.attendingPhysician != msg.sender) revert UnauthorizedAccess(msg.sender);
        if (enc.state != EncounterState.ConsultationActive && enc.state != EncounterState.RecordAnchored) {
            revert InvalidStateTransition(uint8(enc.state), uint8(EncounterState.ConsultationActive));
        }
        _verifyActiveConsent($, enc.patient, msg.sender);

        if (address($.recordsContract) == address(0)) revert InvalidParameters();

        return $.recordsContract.mintPrescription(
            enc.patient,
            medicationCode,
            quantity,
            validUntil,
            msg.sender
        );
    }

    // =============================================================
    //     2. MULTI-SIG EMERGENCY "BREAK-GLASS" OVERRIDE PROTOCOL
    // =============================================================

    /**
     * @notice Multi-Sig emergency override for unconscious trauma patients (Phase III, Project 9).
     *         Requires 2 licensed physicians to co-sign within a 1-hour window.
     *         Grants strictly 24-hour access with immutable on-chain auditing.
     */
    function initiateEmergencyBreakGlass(address patient, address targetPhysician) external onlyRole(PHYSICIAN_ROLE) returns (uint256) {
        if (patient == address(0) || targetPhysician == address(0)) revert ZeroAddressNotAllowed();
        DHRSStorage storage $ = _getStorage();
        if (!hasRole(PHYSICIAN_ROLE, targetPhysician)) revert UnauthorizedAccess(targetPhysician);

        uint256 reqId = ++$.emergencyRequestCounter;
        EmergencyOverrideRequest storage req = $.emergencyRequests[reqId];
        
        req.patient = patient;
        req.targetPhysician = targetPhysician;
        req.createdAt = uint64(block.timestamp);
        req.approvals[msg.sender] = true;
        req.approvalCount = 1;

        emit EmergencyBreakGlassInitiated(reqId, patient, msg.sender);
        return reqId;
    }

    function approveEmergencyBreakGlass(uint256 reqId) external onlyRole(PHYSICIAN_ROLE) {
        DHRSStorage storage $ = _getStorage();
        EmergencyOverrideRequest storage req = $.emergencyRequests[reqId];

        if (req.executed) revert EmergencyOverrideAlreadyExecuted();
        if (req.approvals[msg.sender]) revert DuplicateApproval();
        if (block.timestamp > req.createdAt + 1 hours) revert EmergencyRequestExpired();

        req.approvals[msg.sender] = true;
        req.approvalCount++;

        emit EmergencyBreakGlassApproved(reqId, msg.sender, req.approvalCount);

        if (req.approvalCount >= 2) {
            req.executed = true;
            uint64 expiresAt = uint64(block.timestamp) + 24 hours;
            $.consents[req.patient][req.targetPhysician] = ConsentTicket({
                grantedAt: uint64(block.timestamp),
                expiresAt: expiresAt,
                isEmergencyBreakGlass: true
            });
            emit EmergencyBreakGlassExecuted(reqId, req.patient, req.targetPhysician, expiresAt);
        }
    }

    // =============================================================
    //        3. OFFLINE-FIRST MERKLE DIFF SYNCHRONISATION
    // =============================================================

    /**
     * @notice Rural health clinic offline synchronization (Phase III, Project 12).
     *         Verifies Merkle proofs of locally buffered records and updates on-chain state root.
     */
    function syncOfflineFacilityRecords(
        bytes32 newMerkleRoot,
        address[] calldata patients,
        bytes32[] calldata recordHashes,
        bytes32[][] calldata merkleProofs
    ) external onlyRole(HEALTH_FACILITY_ROLE) whenNotPaused {
        if (patients.length != recordHashes.length || patients.length != merkleProofs.length) {
            revert ArrayLengthMismatch();
        }
        DHRSStorage storage $ = _getStorage();
        bytes32 oldRoot = $.facilityOfflineMerkleRoots[msg.sender];

        for (uint256 i = 0; i < patients.length; i++) {
            bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(patients[i], recordHashes[i]))));
            if (!MerkleProof.verify(merkleProofs[i], newMerkleRoot, leaf)) {
                revert InvalidMerkleProof();
            }
            $.patientMedicalHistory[patients[i]].push(recordHashes[i]);
        }

        $.facilityOfflineMerkleRoots[msg.sender] = newMerkleRoot;
        emit OfflineBatchSynced(msg.sender, oldRoot, newMerkleRoot, patients.length);
    }

    // =============================================================
    //   4. FINANCIAL LOGIC: CBHI CLAIMS & PULL PAYMENT PATTERN
    // =============================================================

    /**
     * @notice FMoH or CBHI Central Fund deposits eETB settlement liquidity into the pool.
     */
    function depositTreasuryFunds(uint256 amount) external onlyRole(CONSORTIUM_GOVERNOR_ROLE) {
        if (amount == 0) revert InvalidParameters();
        DHRSStorage storage $ = _getStorage();
        $.cbhiPaymentToken.safeTransferFrom(msg.sender, address(this), amount);
        emit TreasuryDeposit(msg.sender, amount);
    }

    /**
     * @notice Accredited clinic submits CBHI insurance claim for an anchored encounter.
     */
    function submitCBHIClaim(uint256 encounterId, uint256 claimAmount) external onlyRole(HEALTH_FACILITY_ROLE) {
        if (claimAmount == 0) revert InvalidParameters();
        DHRSStorage storage $ = _getStorage();
        ClinicalEncounter storage enc = $.encounters[encounterId];

        if (enc.facility != msg.sender) revert UnauthorizedAccess(msg.sender);
        _validateState(enc.state, EncounterState.RecordAnchored);

        enc.claimAmount = claimAmount;
        _transitionState(enc, EncounterState.ClaimSubmitted);
    }

    /**
     * @notice Consortium Governor (CBHI Auditor) approves claim and credits clinic via Pull Payment pattern.
     *         Adheres to Phase IV (Project 14: Pull over Push payments).
     */
    function adjudicateAndCreditClaim(uint256 encounterId) external onlyRole(CONSORTIUM_GOVERNOR_ROLE) {
        DHRSStorage storage $ = _getStorage();
        ClinicalEncounter storage enc = $.encounters[encounterId];

        _validateState(enc.state, EncounterState.ClaimSubmitted);
        _transitionState(enc, EncounterState.ClaimAdjudicated);

        // Credit pull-payment escrow instead of pushing tokens (prevents DoS / Reentrancy)
        $.pendingPullPayments[enc.facility] += enc.claimAmount;
        _transitionState(enc, EncounterState.Settled);

        emit PullPaymentCredited(enc.facility, enc.claimAmount);
    }

    /**
     * @notice Pull Payment Withdrawal: Clinics and suppliers safely pull accrued eETB funds.
     *         Adheres strictly to Checks-Effects-Interactions (CEI) + ReentrancyGuard (Phase III, Project 10).
     */
    function withdrawPullPayment() external nonReentrant whenNotPaused {
        DHRSStorage storage $ = _getStorage();
        
        // 1. CHECKS
        uint256 amount = $.pendingPullPayments[msg.sender];
        if (amount == 0) revert InsufficientEscrowBalance();

        // 2. EFFECTS
        $.pendingPullPayments[msg.sender] = 0;

        // 3. INTERACTIONS
        $.cbhiPaymentToken.safeTransfer(msg.sender, amount);

        emit PullPaymentWithdrawn(msg.sender, amount);
    }

    // =============================================================
    //   5. AUCTIONS: EPHI PHARMACEUTICAL REVERSE PROCUREMENT
    // =============================================================

    /**
     * @notice EPHI creates a reverse procurement auction for regional medical supplies.
     *         Adheres to Phase IV (Project 15: Auction & Pending Returns).
     */
    function createSupplyReverseAuction(
        string calldata itemDescription,
        uint256 maxBudget,
        uint64 durationSeconds
    ) external onlyRole(CONSORTIUM_GOVERNOR_ROLE) returns (uint256) {
        if (maxBudget == 0 || durationSeconds == 0) revert InvalidParameters();
        DHRSStorage storage $ = _getStorage();
        uint256 auctionId = ++$.auctionCounter;

        $.auctions[auctionId] = ProcurementAuction({
            itemDescription: itemDescription,
            maxBudget: maxBudget,
            lowestBid: maxBudget,
            winningSupplier: address(0),
            endTime: uint64(block.timestamp) + durationSeconds,
            state: AuctionState.Active
        });

        emit ReverseAuctionCreated(auctionId, itemDescription, maxBudget, uint64(block.timestamp) + durationSeconds);
        return auctionId;
    }

    /**
     * @notice Suppliers submit lower bids to win the pharmaceutical supply contract.
     */
    function placeSupplyBid(uint256 auctionId, uint256 bidAmount) external whenNotPaused {
        DHRSStorage storage $ = _getStorage();
        ProcurementAuction storage auc = $.auctions[auctionId];

        if (auc.state != AuctionState.Active || block.timestamp >= auc.endTime) revert AuctionNotActive();
        if (bidAmount >= auc.lowestBid || bidAmount == 0) revert BidTooHigh(bidAmount, auc.lowestBid);

        auc.lowestBid = bidAmount;
        auc.winningSupplier = msg.sender;

        emit NewLowestBid(auctionId, msg.sender, bidAmount);
    }

    /**
     * @notice EPHI finalizes reverse auction after deadline, crediting winner in Pull Payment escrow.
     */
    function finalizeSupplyAuction(uint256 auctionId) external onlyRole(CONSORTIUM_GOVERNOR_ROLE) {
        DHRSStorage storage $ = _getStorage();
        ProcurementAuction storage auc = $.auctions[auctionId];

        if (auc.state != AuctionState.Active) revert AuctionNotActive();
        if (block.timestamp < auc.endTime) revert AuctionNotActive();

        auc.state = AuctionState.Finalized;
        if (auc.winningSupplier != address(0)) {
            $.pendingPullPayments[auc.winningSupplier] += auc.lowestBid;
            emit PullPaymentCredited(auc.winningSupplier, auc.lowestBid);
        }

        emit ReverseAuctionFinalized(auctionId, auc.winningSupplier, auc.lowestBid);
    }

    /**
     * @notice EPHI can cancel an unfinalized auction if supply parameters change.
     */
    function cancelSupplyAuction(uint256 auctionId) external onlyRole(CONSORTIUM_GOVERNOR_ROLE) {
        DHRSStorage storage $ = _getStorage();
        ProcurementAuction storage auc = $.auctions[auctionId];

        if (auc.state != AuctionState.Active) revert AuctionNotActive();
        auc.state = AuctionState.Cancelled;

        emit ReverseAuctionCancelled(auctionId);
    }

    // =============================================================
    //        6. CIRCUIT BREAKER & UPGRADE GOVERNANCE
    // =============================================================

    function pause() external onlyRole(CONSORTIUM_GOVERNOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(CONSORTIUM_GOVERNOR_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    // =============================================================
    //                 VIEW & QUERY HELPERS
    // =============================================================

    function getEncounter(uint256 encounterId) external view returns (ClinicalEncounter memory) {
        return _getStorage().encounters[encounterId];
    }

    function getPatientHistory(address patient) external view returns (bytes32[] memory) {
        return _getStorage().patientMedicalHistory[patient];
    }

    function getPendingPullPayment(address beneficiary) external view returns (uint256) {
        return _getStorage().pendingPullPayments[beneficiary];
    }

    function getConsent(address patient, address physician) external view returns (ConsentTicket memory) {
        return _getStorage().consents[patient][physician];
    }

    function getAuction(uint256 auctionId) external view returns (
        string memory itemDescription,
        uint256 maxBudget,
        uint256 lowestBid,
        address winningSupplier,
        uint64 endTime,
        AuctionState state
    ) {
        ProcurementAuction storage auc = _getStorage().auctions[auctionId];
        return (
            auc.itemDescription,
            auc.maxBudget,
            auc.lowestBid,
            auc.winningSupplier,
            auc.endTime,
            auc.state
        );
    }

    function getEmergencyRequest(uint256 reqId) external view returns (
        address patient,
        address targetPhysician,
        uint64 createdAt,
        uint8 approvalCount,
        bool executed
    ) {
        EmergencyOverrideRequest storage req = _getStorage().emergencyRequests[reqId];
        return (
            req.patient,
            req.targetPhysician,
            req.createdAt,
            req.approvalCount,
            req.executed
        );
    }

    // =============================================================
    //              INTERNAL VALIDATION HELPERS
    // =============================================================

    function _verifyActiveConsent(DHRSStorage storage $, address patient, address physician) internal view {
        ConsentTicket memory ticket = $.consents[patient][physician];
        if (ticket.grantedAt == 0) revert NoActiveConsent(patient, physician);
        if (block.timestamp > ticket.expiresAt) revert ConsentExpired(ticket.expiresAt, block.timestamp);
    }

    function _validateState(EncounterState current, EncounterState expected) internal pure {
        if (current != expected) revert InvalidStateTransition(uint8(current), uint8(expected));
    }

    function _transitionState(ClinicalEncounter storage enc, EncounterState newState) internal {
        EncounterState oldState = enc.state;
        enc.state = newState;
        enc.updatedAt = uint64(block.timestamp);
        emit EncounterStateChanged(enc.encounterId, oldState, newState, uint64(block.timestamp));
    }
}

