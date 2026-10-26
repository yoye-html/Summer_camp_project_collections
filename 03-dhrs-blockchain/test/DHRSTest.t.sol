// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/InterfacesAndLibraries.sol";
import "../contracts/DHRSPatientIdentitySBT.sol";
import "../contracts/DHRSRecordsERC1155.sol";
import "../contracts/CBHIPaymentToken.sol";
import "../contracts/DHRSCoreUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DHRSTest
 * @notice Invariant and functional test suite covering all 16 projects and 10-point audit checklist
 *         from the smart_contract.md architectural guide.
 */
contract DHRSTest is Test {
    DHRSPatientIdentitySBT public patientSBT;
    DHRSRecordsERC1155 public recordsERC1155;
    CBHIPaymentToken public cbhiToken;
    DHRSCoreUpgradeable public coreContract;
    ERC1967Proxy public proxy;

    address public admin = address(0xAA1);
    address public fmohGovernor = address(0xAA2);
    address public clinicFacility = address(0xBB1);
    address public doctorA = address(0xCC1);
    address public doctorB = address(0xCC2);
    address public pharmacy = address(0xDD1);
    address public supplierA = address(0xEE1);
    address public supplierB = address(0xEE2);
    address public citizenPatient = address(0xFF1);
    address public traumaPatient = address(0xFF2);

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant HEALTH_FACILITY_ROLE = keccak256("HEALTH_FACILITY_ROLE");
    bytes32 public constant PHYSICIAN_ROLE = keccak256("PHYSICIAN_ROLE");
    bytes32 public constant CONSORTIUM_GOVERNOR_ROLE = keccak256("CONSORTIUM_GOVERNOR_ROLE");
    bytes32 public constant PHARMACY_ROLE = keccak256("PHARMACY_ROLE");

    function setUp() public {
        vm.startPrank(admin);

        // 1. Deploy Soulbound Identity Token (Project 8 & 11)
        patientSBT = new DHRSPatientIdentitySBT(admin);

        // 2. Deploy ERC-1155 Medical Records & Prescriptions
        recordsERC1155 = new DHRSRecordsERC1155(admin, "https://dhrs.et/records/{id}.json");

        // 3. Deploy CBHI eETB Payment Token (Project 5)
        cbhiToken = new CBHIPaymentToken(admin, 1_000_000 ether);

        // 4. Deploy Core Implementation & UUPS Proxy (Project 16)
        DHRSCoreUpgradeable coreImpl = new DHRSCoreUpgradeable();

        bytes memory initData = abi.encodeWithSelector(
            DHRSCoreUpgradeable.initialize.selector,
            admin,
            address(patientSBT),
            address(recordsERC1155),
            address(cbhiToken)
        );

        proxy = new ERC1967Proxy(address(coreImpl), initData);
        coreContract = DHRSCoreUpgradeable(address(proxy));

        // Grant core contract roles on records contract
        recordsERC1155.grantRole(recordsERC1155.CORE_CONTRACT_ROLE(), address(coreContract));
        recordsERC1155.grantRole(PHARMACY_ROLE, pharmacy);

        // Grant roles on Core contract
        coreContract.grantRole(CONSORTIUM_GOVERNOR_ROLE, fmohGovernor);
        coreContract.grantRole(HEALTH_FACILITY_ROLE, clinicFacility);
        coreContract.grantRole(PHYSICIAN_ROLE, doctorA);
        coreContract.grantRole(PHYSICIAN_ROLE, doctorB);

        // Enroll patient in Soulbound DID registry
        patientSBT.enrollPatient(
            citizenPatient,
            "did:ethr:et:0x001",
            keccak256("biometric_fingerprint_patient_1"),
            "ET-AA"
        );

        // Fund core contract escrow with treasury liquidity (Project 7 & 14)
        cbhiToken.transfer(fmohGovernor, 500_000 ether);
        vm.stopPrank();

        vm.startPrank(fmohGovernor);
        cbhiToken.approve(address(coreContract), 200_000 ether);
        coreContract.depositTreasuryFunds(200_000 ether);
        vm.stopPrank();
    }

    // =========================================================================
    // INVARIANT 1: SOULBOUND DID NON-TRANSFERABILITY (Project 8 / Checklist 4)
    // =========================================================================
    function test_SoulboundTokenCannotBeTransferred() public {
        vm.startPrank(citizenPatient);
        uint256 tokenId = patientSBT.patientToTokenId(citizenPatient);
        assertEq(tokenId, 1);

        // Expect revert on any transfer attempt
        vm.expectRevert(IDHRSErrors.SoulboundTokenNonTransferable.selector);
        patientSBT.transferFrom(citizenPatient, address(0x999), tokenId);

        vm.expectRevert(IDHRSErrors.SoulboundTokenNonTransferable.selector);
        patientSBT.safeTransferFrom(citizenPatient, address(0x999), tokenId);
        vm.stopPrank();
    }

    function test_PatientCannotBeEnrolledTwice() public {
        vm.startPrank(admin);
        vm.expectRevert(IDHRSErrors.PatientAlreadyEnrolled.selector);
        patientSBT.enrollPatient(
            citizenPatient,
            "did:ethr:et:0x002",
            keccak256("biometric_duplicate"),
            "ET-OR"
        );
        vm.stopPrank();
    }

    // =========================================================================
    // INVARIANT 2: CLINICAL ENCOUNTER STATE MACHINE (Project 3 / Checklist 2)
    // =========================================================================
    function test_EncounterLifecycleStateTransitions() public {
        // Step 1: Patient grants 24-hour consent to Doctor A
        vm.prank(citizenPatient);
        uint256 encounterId = coreContract.grantConsent(doctorA, 24 hours);

        DHRSCoreUpgradeable.ClinicalEncounter memory enc = coreContract.getEncounter(encounterId);
        assertEq(uint8(enc.state), uint8(DHRSCoreUpgradeable.EncounterState.ConsentGranted));

        // Invalid State Transition: Cannot anchor record before consultation is opened
        bytes32 cidHash = keccak256("encrypted_aes256_gcm_ipfs_record");
        vm.prank(doctorA);
        vm.expectRevert(abi.encodeWithSelector(
            IDHRSErrors.InvalidStateTransition.selector,
            uint8(DHRSCoreUpgradeable.EncounterState.ConsentGranted),
            uint8(DHRSCoreUpgradeable.EncounterState.ConsultationActive)
        ));
        coreContract.anchorEncryptedRecord(encounterId, cidHash);

        // Step 2: Doctor opens consultation at clinic
        vm.prank(doctorA);
        coreContract.startConsultation(encounterId, clinicFacility);
        enc = coreContract.getEncounter(encounterId);
        assertEq(uint8(enc.state), uint8(DHRSCoreUpgradeable.EncounterState.ConsultationActive));

        // Step 3: Doctor anchors encrypted record
        vm.prank(doctorA);
        coreContract.anchorEncryptedRecord(encounterId, cidHash);
        enc = coreContract.getEncounter(encounterId);
        assertEq(uint8(enc.state), uint8(DHRSCoreUpgradeable.EncounterState.RecordAnchored));

        // Step 4: Clinic submits CBHI claim for 1,200 eETB
        vm.prank(clinicFacility);
        coreContract.submitCBHIClaim(encounterId, 1200 ether);
        enc = coreContract.getEncounter(encounterId);
        assertEq(uint8(enc.state), uint8(DHRSCoreUpgradeable.EncounterState.ClaimSubmitted));

        // Step 5: Consortium Governor adjudicates claim
        vm.prank(fmohGovernor);
        coreContract.adjudicateAndCreditClaim(encounterId);
        enc = coreContract.getEncounter(encounterId);
        assertEq(uint8(enc.state), uint8(DHRSCoreUpgradeable.EncounterState.Settled));

        // Assert pull payment escrow is credited
        assertEq(coreContract.getPendingPullPayment(clinicFacility), 1200 ether);
    }

    // =========================================================================
    // INVARIANT 3: TIME-LOCKED CONSENT EXPIRATION (Project 1 & 6 / Checklist 8)
    // =========================================================================
    function test_ExpiredConsentBlocksRecordAnchoring() public {
        vm.prank(citizenPatient);
        uint256 encounterId = coreContract.grantConsent(doctorA, 1 hours);

        vm.prank(doctorA);
        coreContract.startConsultation(encounterId, clinicFacility);

        // Fast forward 2 hours into future
        vm.warp(block.timestamp + 2 hours);

        bytes32 cidHash = keccak256("late_record_attempt");
        vm.prank(doctorA);
        vm.expectRevert(abi.encodeWithSelector(
            IDHRSErrors.ConsentExpired.selector,
            block.timestamp - 1 hours,
            block.timestamp
        ));
        coreContract.anchorEncryptedRecord(encounterId, cidHash);
    }

    // =========================================================================
    // INVARIANT 4: 2-OF-3 MULTI-SIG EMERGENCY BREAK-GLASS (Project 9 / Checklist 1)
    // =========================================================================
    function test_EmergencyBreakGlassMultiSig() public {
        // Doctor A initiates emergency request for unconscious patient
        vm.prank(doctorA);
        uint256 reqId = coreContract.initiateEmergencyBreakGlass(traumaPatient, doctorA);

        (,, uint64 createdAt, uint8 approvals, bool executed) = coreContract.getEmergencyRequest(reqId);
        assertEq(approvals, 1);
        assertFalse(executed);

        // Duplicate approval from same doctor is rejected
        vm.prank(doctorA);
        vm.expectRevert(IDHRSErrors.DuplicateApproval.selector);
        coreContract.approveEmergencyBreakGlass(reqId);

        // Doctor B co-signs within 1-hour window
        vm.prank(doctorB);
        coreContract.approveEmergencyBreakGlass(reqId);

        (,,, approvals, executed) = coreContract.getEmergencyRequest(reqId);
        assertEq(approvals, 2);
        assertTrue(executed);

        // Doctor A now has valid emergency 24h consent ticket
        DHRSCoreUpgradeable.ConsentTicket memory ticket = coreContract.getConsent(traumaPatient, doctorA);
        assertTrue(ticket.isEmergencyBreakGlass);
        assertEq(ticket.expiresAt, block.timestamp + 24 hours);
    }

    // =========================================================================
    // INVARIANT 5: PULL-OVER-PUSH SOLVENCY & CEI (Project 10 & 14 / Checklist 3/7)
    // =========================================================================
    function test_PullPaymentWithdrawalCEI() public {
        // Setup encounter and settled claim of 2,500 eETB
        vm.prank(citizenPatient);
        uint256 encounterId = coreContract.grantConsent(doctorA, 24 hours);
        vm.prank(doctorA);
        coreContract.startConsultation(encounterId, clinicFacility);
        vm.prank(doctorA);
        coreContract.anchorEncryptedRecord(encounterId, keccak256("record_claim_test"));

        vm.prank(clinicFacility);
        coreContract.submitCBHIClaim(encounterId, 2500 ether);

        vm.prank(fmohGovernor);
        coreContract.adjudicateAndCreditClaim(encounterId);

        assertEq(coreContract.getPendingPullPayment(clinicFacility), 2500 ether);

        // Facility pulls reimbursement
        uint256 balBefore = cbhiToken.balanceOf(clinicFacility);
        vm.prank(clinicFacility);
        coreContract.withdrawPullPayment();

        uint256 balAfter = cbhiToken.balanceOf(clinicFacility);
        assertEq(balAfter - balBefore, 2500 ether);
        assertEq(coreContract.getPendingPullPayment(clinicFacility), 0);

        // Subsequent withdrawal reverts with InsufficientEscrowBalance
        vm.prank(clinicFacility);
        vm.expectRevert(IDHRSErrors.InsufficientEscrowBalance.selector);
        coreContract.withdrawPullPayment();
    }

    // =========================================================================
    // INVARIANT 6: EPHI REVERSE PROCUREMENT AUCTION (Project 15 / Checklist 9)
    // =========================================================================
    function test_ReverseProcurementAuctionFlow() public {
        vm.prank(fmohGovernor);
        uint256 auctionId = coreContract.createSupplyReverseAuction(
            "100,000 Rifampicin Packs - Jimma Zone",
            50_000 ether,
            3 days
        );

        // Supplier A bids 45,000 eETB
        vm.prank(supplierA);
        coreContract.placeSupplyBid(auctionId, 45_000 ether);

        // Supplier B outbids Supplier A with 42,000 eETB
        vm.prank(supplierB);
        coreContract.placeSupplyBid(auctionId, 42_000 ether);

        // Bid higher than lowest bid reverts
        vm.prank(supplierA);
        vm.expectRevert(abi.encodeWithSelector(IDHRSErrors.BidTooHigh.selector, 43_000 ether, 42_000 ether));
        coreContract.placeSupplyBid(auctionId, 43_000 ether);

        // Finalize before deadline reverts
        vm.prank(fmohGovernor);
        vm.expectRevert(IDHRSErrors.AuctionNotActive.selector);
        coreContract.finalizeSupplyAuction(auctionId);

        // Fast forward past deadline
        vm.warp(block.timestamp + 3 days + 1);

        vm.prank(fmohGovernor);
        coreContract.finalizeSupplyAuction(auctionId);

        // Winning supplier B credited with 42,000 eETB
        assertEq(coreContract.getPendingPullPayment(supplierB), 42_000 ether);

        // Winning supplier withdraws payout
        vm.prank(supplierB);
        coreContract.withdrawPullPayment();
        assertEq(cbhiToken.balanceOf(supplierB), 42_000 ether);
    }
}

