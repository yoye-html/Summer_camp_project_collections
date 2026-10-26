// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./InterfacesAndLibraries.sol";

/**
 * @title DHRSAccountRecovery
 * @notice Guardian-Based Social Recovery for Ethiopian Citizens (ERC-4337 Architecture).
 * 
 * PROBLEM SOLVED:
 * Rural and non-crypto-native citizens CANNOT reliably store 12-word seed phrases.
 * If a citizen loses their seed phrase, traditional crypto locks them out of their health records forever.
 * 
 * SOLUTION:
 * 1. The citizen's identity is an on-chain account anchored to their W3C DID.
 * 2. Key management is bound to an ISO 7816 Smart Card hardware chip.
 * 3. In case of lost/damaged card, 2-of-3 Guardians can rotate the citizen's key:
 *    - Guardian A: Kebele Registrar Office (REGISTRAR_ROLE)
 *    - Guardian B: Accredited Regional Hospital (HEALTH_FACILITY_ROLE)
 *    - Guardian C: Designated Next-of-Kin / Family Member
 * ZERO seed phrases required from the patient.
 */
contract DHRSAccountRecovery is AccessControl, IDHRSErrors {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant HEALTH_FACILITY_ROLE = keccak256("HEALTH_FACILITY_ROLE");

    struct RecoveryConfig {
        address nextOfKin;
        address activeSigningKey;
        uint256 recoveryNonce;
        bool exists;
    }

    struct RecoveryRequest {
        address newSigningKey;
        uint64 initiatedAt;
        uint8 approvalCount;
        bool executed;
        mapping(address => bool) hasApproved;
    }

    // Patient Address => Recovery Configuration
    mapping(address => RecoveryConfig) public patientConfigs;

    // Patient Address => Nonce => Active Recovery Request
    mapping(address => mapping(uint256 => RecoveryRequest)) public recoveryRequests;

    event RecoveryConfigured(address indexed patient, address indexed nextOfKin, address initialKey);
    event RecoveryInitiated(address indexed patient, uint256 indexed nonce, address proposedKey);
    event RecoveryApproved(address indexed patient, uint256 indexed nonce, address indexed guardian);
    event KeyRotatedSuccessfully(address indexed patient, address oldKey, address newKey);

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddressNotAllowed();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
        _grantRole(HEALTH_FACILITY_ROLE, admin);
    }

    /**
     * @notice Enrolls citizen recovery guardians during Kebele smart card issuance.
     */
    function setupRecovery(
        address patient,
        address nextOfKin,
        address initialSigningKey
    ) external onlyRole(REGISTRAR_ROLE) {
        if (patient == address(0) || initialSigningKey == address(0)) revert ZeroAddressNotAllowed();

        patientConfigs[patient] = RecoveryConfig({
            nextOfKin: nextOfKin,
            activeSigningKey: initialSigningKey,
            recoveryNonce: 0,
            exists: true
        });

        emit RecoveryConfigured(patient, nextOfKin, initialSigningKey);
    }

    /**
     * @notice Guardian initiates key replacement when citizen loses card or phone.
     */
    function initiateRecovery(
        address patient,
        address newSigningKey
    ) external returns (uint256) {
        RecoveryConfig storage config = patientConfigs[patient];
        if (!config.exists) revert UnauthorizedAccess(patient);
        _validateGuardian(patient, msg.sender);

        uint256 nonce = ++config.recoveryNonce;
        RecoveryRequest storage req = recoveryRequests[patient][nonce];

        req.newSigningKey = newSigningKey;
        req.initiatedAt = uint64(block.timestamp);
        req.approvalCount = 1;
        req.hasApproved[msg.sender] = true;

        emit RecoveryInitiated(patient, nonce, newSigningKey);
        emit RecoveryApproved(patient, nonce, msg.sender);
        return nonce;
    }

    /**
     * @notice Second guardian co-signs the recovery request.
     *         Requires 2-of-3 threshold (e.g. Kebele Registrar + Hospital Doctor).
     */
    function approveRecovery(address patient, uint256 nonce) external {
        RecoveryConfig storage config = patientConfigs[patient];
        RecoveryRequest storage req = recoveryRequests[patient][nonce];

        if (req.executed) revert EmergencyOverrideAlreadyExecuted();
        if (block.timestamp > req.initiatedAt + 3 days) revert EmergencyRequestExpired();
        _validateGuardian(patient, msg.sender);
        if (req.hasApproved[msg.sender]) revert DuplicateApproval();

        req.hasApproved[msg.sender] = true;
        req.approvalCount++;

        emit RecoveryApproved(patient, nonce, msg.sender);

        // Threshold reached: 2 out of 3 guardians verified citizen biometric identity
        if (req.approvalCount >= 2) {
            req.executed = true;
            address oldKey = config.activeSigningKey;
            config.activeSigningKey = req.newSigningKey;
            emit KeyRotatedSuccessfully(patient, oldKey, req.newSigningKey);
        }
    }

    function _validateGuardian(address patient, address caller) internal view {
        RecoveryConfig storage config = patientConfigs[patient];
        bool isNextOfKin = (caller == config.nextOfKin && caller != address(0));
        bool isRegistrar = hasRole(REGISTRAR_ROLE, caller);
        bool isHospital = hasRole(HEALTH_FACILITY_ROLE, caller);

        if (!isNextOfKin && !isRegistrar && !isHospital) {
            revert UnauthorizedAccess(caller);
        }
    }

    /**
     * @notice Verifies if a given key is the active authorized signing key for a citizen.
     */
    function getActiveKey(address patient) external view returns (address) {
        return patientConfigs[patient].activeSigningKey;
    }
}

