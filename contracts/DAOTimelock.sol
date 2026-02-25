// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title DAOTimelock
/// @notice TimelockController that enforces a delay between proposal approval and execution.
/// @dev Roles:
///   - PROPOSER_ROLE: Granted to the Governor contract (only governance can propose)
///   - EXECUTOR_ROLE: Granted to address(0) so anyone can trigger execution after delay
///   - CANCELLER_ROLE: Granted to the Governor contract
///   - DEFAULT_ADMIN_ROLE: Initially the deployer, renounced after setup to make DAO autonomous
contract DAOTimelock is TimelockController {
    /// @param _minDelay Minimum delay in seconds before a queued operation can be executed
    /// @param _proposers Addresses granted the PROPOSER_ROLE (typically the Governor)
    /// @param _executors Addresses granted the EXECUTOR_ROLE (address(0) = open execution)
    /// @param _admin Address granted DEFAULT_ADMIN_ROLE (renounced after setup)
    constructor(
        uint256 _minDelay,
        address[] memory _proposers,
        address[] memory _executors,
        address _admin
    ) TimelockController(_minDelay, _proposers, _executors, _admin) {}
}
