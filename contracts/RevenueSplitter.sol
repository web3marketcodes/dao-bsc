// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Interface for StakingVault to receive rewards
interface IStakingVault {
    function addRewards(uint256 amount) external;
}

/// @title RevenueSplitter
/// @notice Splits accumulated TaxToken revenue between staking rewards, burn, and dev wallet.
/// @dev After setup, ownership is transferred to the DAOTimelock so only governance can modify shares.
contract RevenueSplitter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    IERC20 public immutable taxToken;
    address public stakingVault;
    address public devWallet;

    uint256 public stakingShare; // basis points
    uint256 public burnShare;    // basis points
    uint256 public devShare;     // basis points

    event SharesUpdated(uint256 stakingShare, uint256 burnShare, uint256 devShare);
    event DevWalletUpdated(address newDevWallet);
    event StakingVaultUpdated(address newStakingVault);
    event RevenueDistributed(uint256 stakingAmount, uint256 burnAmount, uint256 devAmount);

    /// @param _taxToken Address of the TaxToken contract
    /// @param _stakingVault Address of the StakingVault contract
    /// @param _devWallet Address to receive dev share
    /// @param _owner Initial owner address
    constructor(
        address _taxToken,
        address _stakingVault,
        address _devWallet,
        address _owner
    ) Ownable(_owner) {
        taxToken = IERC20(_taxToken);
        stakingVault = _stakingVault;
        devWallet = _devWallet;

        // Default shares: 50% staking, 20% burn, 30% dev
        stakingShare = 5000;
        burnShare = 2000;
        devShare = 3000;
    }

    // ─── Owner Setters ───────────────────────────────────────────────

    function setShares(
        uint256 _stakingShare,
        uint256 _burnShare,
        uint256 _devShare
    ) external onlyOwner {
        require(
            _stakingShare + _burnShare + _devShare <= 10000,
            "RevenueSplitter: shares exceed 100%"
        );
        stakingShare = _stakingShare;
        burnShare = _burnShare;
        devShare = _devShare;
        emit SharesUpdated(_stakingShare, _burnShare, _devShare);
    }

    function setDevWallet(address _devWallet) external onlyOwner {
        devWallet = _devWallet;
        emit DevWalletUpdated(_devWallet);
    }

    function setStakingVault(address _stakingVault) external onlyOwner {
        stakingVault = _stakingVault;
        emit StakingVaultUpdated(_stakingVault);
    }

    // ─── Distribution ────────────────────────────────────────────────

    /// @notice Distributes accumulated TaxToken balance according to configured shares.
    function distribute() external nonReentrant {
        uint256 balance = taxToken.balanceOf(address(this));
        require(balance > 0, "RevenueSplitter: nothing to distribute");

        uint256 stakingAmount = (balance * stakingShare) / 10000;
        uint256 burnAmount = (balance * burnShare) / 10000;
        uint256 devAmount = balance - stakingAmount - burnAmount; // remainder to dev

        if (stakingAmount > 0 && stakingVault != address(0)) {
            taxToken.forceApprove(stakingVault, stakingAmount);
            IStakingVault(stakingVault).addRewards(stakingAmount);
        }

        if (burnAmount > 0) {
            taxToken.safeTransfer(DEAD_ADDRESS, burnAmount);
        }

        if (devAmount > 0 && devWallet != address(0)) {
            taxToken.safeTransfer(devWallet, devAmount);
        }

        emit RevenueDistributed(stakingAmount, burnAmount, devAmount);
    }

    /// @notice Returns the accumulated TaxToken balance available for distribution.
    function getAccumulatedBalance() external view returns (uint256) {
        return taxToken.balanceOf(address(this));
    }
}
