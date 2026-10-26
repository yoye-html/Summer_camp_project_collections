// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IDHRSPatientDID
 * @notice Interface for the Patient Soulbound Identity contract
 */
interface IDHRSPatientDID {
    function verifyPatient(address patient) external view returns (bool);
    function getPatientDID(address patient) external view returns (string memory);
    function getPatientRegion(address patient) external view returns (string memory);
}

/**
 * @title IDHRSRecordsERC1155
 * @notice Interface for medical records (NFT) and electronic prescriptions (Semi-Fungible)
 */
interface IDHRSRecordsERC1155 {
    function mintClinicalRecord(
        address patient,
        bytes32 ipfsHash,
        address provider
    ) external returns (uint256 tokenId);

    function mintPrescription(
        address patient,
        uint256 medicationCode,
        uint256 quantity,
        uint64 validUntil,
        address physician
    ) external returns (uint256 tokenId);

    function dispensePrescription(
        uint256 tokenId,
        uint256 quantity,
        address pharmacy
    ) external;
}

/**
 * @title IDHRSErrors
 * @notice Custom gas-efficient errors conforming to Phase 3 & 4 security standards
 */
interface IDHRSErrors {
    error UnauthorizedAccess(address caller);
    error InvalidRole(address caller, bytes32 requiredRole);
    error InvalidStateTransition(uint8 current, uint8 target);
    error ConsentExpired(uint256 expiredAt, uint256 currentTime);
    error NoActiveConsent(address patient, address provider);
    error SoulboundTokenNonTransferable();
    error InvalidMerkleProof();
    error InsufficientEscrowBalance();
    error InsufficientTreasuryDeposit();
    error AuctionNotActive();
    error AuctionEnded();
    error BidTooHigh(uint256 bid, uint256 currentLowest);
    error EmergencyOverrideAlreadyExecuted();
    error ZeroAddressNotAllowed();
    error InvalidParameters();
    error ArrayLengthMismatch();
    error PrescriptionAlreadyDispensed();
    error PrescriptionExpired();
    error EncounterAlreadyAnchored();
    error EmergencyRequestExpired();
    error DuplicateApproval();
    error PatientAlreadyEnrolled();
}

