// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./InterfacesAndLibraries.sol";

/**
 * @title CBHIPaymentToken
 * @notice Digital Ethiopian Birr (eETB) for Community-Based Health Insurance (CBHI) settlements.
 *         Governed by the Ethiopian Federal Ministry of Health (FMoH) and Regional Health Bureaus.
 *         Adheres to Phase II (Project 5: Standard ERC-20) and Phase III (Project 11: RBAC).
 */
contract CBHIPaymentToken is ERC20, ERC20Burnable, AccessControl, IDHRSErrors {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant CBHI_TREASURY_ROLE = keccak256("CBHI_TREASURY_ROLE");

    constructor(
        address admin,
        uint256 initialTreasurySupply
    ) ERC20("Ethiopian Health Settlement Birr", "eETB") {
        if (admin == address(0)) revert ZeroAddressNotAllowed();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(CBHI_TREASURY_ROLE, admin);

        if (initialTreasurySupply > 0) {
            _mint(admin, initialTreasurySupply);
        }
    }

    /**
     * @notice Allows CBHI Treasury / FMoH to mint subsidy allocations into the insurance pool.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert ZeroAddressNotAllowed();
        _mint(to, amount);
    }
}

