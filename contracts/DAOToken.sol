// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

/// @title DAOToken
/// @notice ERC20 governance token with voting power delegation and EIP-2612 permit.
/// @dev Inherits ERC20Votes (checkpoints + delegation) and ERC20Permit (gasless approvals).
///      Token holders must delegate to themselves (or another address) to activate voting power.
contract DAOToken is ERC20, ERC20Permit, ERC20Votes {
    /// @param _name Token name
    /// @param _symbol Token symbol
    /// @param _initialSupply Total supply minted to deployer (in whole tokens, not wei)
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) ERC20Permit(_name) {
        _mint(msg.sender, _initialSupply * 10 ** decimals());
    }

    // ─── Required Overrides ────────────────────────────────────────────

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
