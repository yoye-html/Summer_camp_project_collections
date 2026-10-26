// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./InterfacesAndLibraries.sol";

/**
 * @title DHRSPatientIdentitySBT
 * @notice W3C DID-anchored Soulbound ERC-721 token for Ethiopian Citizens.
 *         Adheres to Phase II (Project 8: ERC-721) and Phase III (Project 11: RBAC).
 *         Prevents transferability to ensure non-forgeable biometric and national identity binding.
 */
contract DHRSPatientIdentitySBT is ERC721, AccessControl, IDHRSPatientDID, IDHRSErrors {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE"); // Kebele / Hospital Registrars

    uint256 private _nextTokenId;

    struct IdentityMetadata {
        string w3cDID;         // e.g., "did:ethr:et:0x..."
        bytes32 biometricHash; // SHA-256 salted hash of fingerprint template (ISO 7816 smart card anchor)
        string regionCode;     // e.g., "ET-AA", "ET-OR", "ET-AM", "ET-TI", "ET-SN"
        uint64 enrolledAt;     // Timestamp of initial enrollment
        bool active;           // Status flag
    }

    mapping(address => uint256) public patientToTokenId;
    mapping(uint256 => IdentityMetadata) public tokenMetadata;

    event PatientEnrolled(
        address indexed patient,
        uint256 indexed tokenId,
        string w3cDID,
        string regionCode,
        uint64 enrolledAt
    );
    event PatientStatusUpdated(uint256 indexed tokenId, bool indexed active);

    constructor(address admin) ERC721("Ethiopian Health Identity SBT", "DHRS-DID") {
        if (admin == address(0)) revert ZeroAddressNotAllowed();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
        _nextTokenId = 1;
    }

    /**
     * @notice Enrolls a new citizen into the National Health Registry.
     * @param patient Ethiopian citizen wallet/smartcard address
     * @param w3cDID Canonical W3C DID identifier
     * @param biometricHash Cryptographic fingerprint/iris template digest
     * @param regionCode Regional Health Bureau identifier (e.g. "ET-AA")
     */
    function enrollPatient(
        address patient,
        string calldata w3cDID,
        bytes32 biometricHash,
        string calldata regionCode
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256) {
        if (patient == address(0)) revert ZeroAddressNotAllowed();
        if (patientToTokenId[patient] != 0) revert PatientAlreadyEnrolled();

        uint256 tokenId = _nextTokenId++;
        _safeMint(patient, tokenId);

        patientToTokenId[patient] = tokenId;
        tokenMetadata[tokenId] = IdentityMetadata({
            w3cDID: w3cDID,
            biometricHash: biometricHash,
            regionCode: regionCode,
            enrolledAt: uint64(block.timestamp),
            active: true
        });

        emit PatientEnrolled(patient, tokenId, w3cDID, regionCode, uint64(block.timestamp));
        return tokenId;
    }

    /**
     * @notice Allows registrars to update active status (e.g., loss of card, deceased record).
     */
    function setPatientActiveStatus(uint256 tokenId, bool active) external onlyRole(REGISTRAR_ROLE) {
        if (_ownerOf(tokenId) == address(0)) revert UnauthorizedAccess(msg.sender);
        tokenMetadata[tokenId].active = active;
        emit PatientStatusUpdated(tokenId, active);
    }

    /**
     * @notice Verifies if an address holds an active Ethiopian Patient DID.
     */
    function verifyPatient(address patient) external view override returns (bool) {
        uint256 tokenId = patientToTokenId[patient];
        return tokenId != 0 && tokenMetadata[tokenId].active;
    }

    /**
     * @notice Returns W3C DID string for a verified patient address.
     */
    function getPatientDID(address patient) external view override returns (string memory) {
        uint256 tokenId = patientToTokenId[patient];
        if (tokenId == 0 || !tokenMetadata[tokenId].active) revert UnauthorizedAccess(patient);
        return tokenMetadata[tokenId].w3cDID;
    }

    /**
     * @notice Returns region code for epidemiological tracking (e.g. by EPHI).
     */
    function getPatientRegion(address patient) external view override returns (string memory) {
        uint256 tokenId = patientToTokenId[patient];
        if (tokenId == 0 || !tokenMetadata[tokenId].active) revert UnauthorizedAccess(patient);
        return tokenMetadata[tokenId].regionCode;
    }

    /**
     * @dev Overrides OpenZeppelin ERC721 _update to enforce Soulbound semantics.
     *      Transfers between non-zero addresses are strictly prohibited.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert SoulboundTokenNonTransferable();
        }
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

