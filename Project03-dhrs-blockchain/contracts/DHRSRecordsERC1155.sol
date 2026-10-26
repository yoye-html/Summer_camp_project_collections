// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./InterfacesAndLibraries.sol";

/**
 * @title DHRSRecordsERC1155
 * @notice Multi-token standard for Ethiopian Clinical Encounters & Prescriptions.
 *         - Non-fungible IDs (Supply = 1): Represent unique encrypted IPFS medical records.
 *         - Semi-fungible IDs (Supply = Quantity): Represent redeemable e-prescriptions with expiry.
 *         Adheres to Phase II (Project 8: ERC-1155), Phase III (Project 11: RBAC),
 *         and Phase III (Project 12: Supply Chain traceability).
 */
contract DHRSRecordsERC1155 is ERC1155, AccessControl, IDHRSRecordsERC1155, IDHRSErrors {
    bytes32 public constant CORE_CONTRACT_ROLE = keccak256("CORE_CONTRACT_ROLE");
    bytes32 public constant PHARMACY_ROLE = keccak256("PHARMACY_ROLE");

    uint256 private _nextTokenId;

    enum RecordKind {
        ClinicalDiagnosisNFT,
        ElectronicPrescriptionSFT
    }

    struct RecordData {
        RecordKind kind;
        address patient;
        address providerOrPhysician;
        bytes32 ipfsHash;
        uint256 medicationCode;
        uint256 totalAuthorized;
        uint256 remainingQuantity;
        uint64 createdAt;
        uint64 validUntil;
    }

    mapping(uint256 => RecordData) public recordData;

    event ClinicalRecordMinted(
        uint256 indexed tokenId,
        address indexed patient,
        address indexed provider,
        bytes32 ipfsHash
    );
    event PrescriptionIssued(
        uint256 indexed tokenId,
        address indexed patient,
        address indexed physician,
        uint256 medicationCode,
        uint256 quantity,
        uint64 validUntil
    );
    event PrescriptionDispensed(
        uint256 indexed tokenId,
        address indexed pharmacy,
        uint256 quantityDispensed,
        uint256 remainingQuantity
    );

    constructor(address admin, string memory uri_) ERC1155(uri_) {
        if (admin == address(0)) revert ZeroAddressNotAllowed();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CORE_CONTRACT_ROLE, admin);
        _grantRole(PHARMACY_ROLE, admin);
        _nextTokenId = 1;
    }

    /**
     * @notice Mints an immutable clinical record NFT anchored to an encrypted IPFS hash.
     */
    function mintClinicalRecord(
        address patient,
        bytes32 ipfsHash,
        address provider
    ) external onlyRole(CORE_CONTRACT_ROLE) returns (uint256 tokenId) {
        if (patient == address(0) || provider == address(0)) revert ZeroAddressNotAllowed();

        tokenId = _nextTokenId++;
        recordData[tokenId] = RecordData({
            kind: RecordKind.ClinicalDiagnosisNFT,
            patient: patient,
            providerOrPhysician: provider,
            ipfsHash: ipfsHash,
            medicationCode: 0,
            totalAuthorized: 1,
            remainingQuantity: 0,
            createdAt: uint64(block.timestamp),
            validUntil: 0
        });

        _mint(patient, tokenId, 1, "");
        emit ClinicalRecordMinted(tokenId, patient, provider, ipfsHash);
    }

    /**
     * @notice Mints an electronic prescription semi-fungible token (e.g. 30 capsules).
     */
    function mintPrescription(
        address patient,
        uint256 medicationCode,
        uint256 quantity,
        uint64 validUntil,
        address physician
    ) external onlyRole(CORE_CONTRACT_ROLE) returns (uint256 tokenId) {
        if (patient == address(0) || physician == address(0)) revert ZeroAddressNotAllowed();
        if (quantity == 0 || validUntil <= block.timestamp) revert InvalidParameters();

        tokenId = _nextTokenId++;
        recordData[tokenId] = RecordData({
            kind: RecordKind.ElectronicPrescriptionSFT,
            patient: patient,
            providerOrPhysician: physician,
            ipfsHash: bytes32(0),
            medicationCode: medicationCode,
            totalAuthorized: quantity,
            remainingQuantity: quantity,
            createdAt: uint64(block.timestamp),
            validUntil: validUntil
        });

        _mint(patient, tokenId, quantity, "");
        emit PrescriptionIssued(tokenId, patient, physician, medicationCode, quantity, validUntil);
    }

    /**
     * @notice Dispenses prescription units at an accredited Ethiopian pharmacy.
     *         Enforces expiration checks and burns dispensed tokens.
     */
    function dispensePrescription(
        uint256 tokenId,
        uint256 quantity,
        address pharmacy
    ) external onlyRole(PHARMACY_ROLE) {
        RecordData storage rec = recordData[tokenId];
        if (rec.kind != RecordKind.ElectronicPrescriptionSFT) revert InvalidParameters();
        if (block.timestamp > rec.validUntil) revert PrescriptionExpired();
        if (rec.remainingQuantity < quantity || quantity == 0) revert PrescriptionAlreadyDispensed();

        rec.remainingQuantity -= quantity;
        _burn(rec.patient, tokenId, quantity);

        emit PrescriptionDispensed(tokenId, pharmacy, quantity, rec.remainingQuantity);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

