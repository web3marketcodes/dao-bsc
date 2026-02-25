// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title StakingVault
/// @notice Stake DAOToken to earn TaxToken rewards using the Synthetix RewardPerToken pattern.
/// @dev After setup, ownership is transferred to the DAOTimelock so only governance can modify parameters.
contract StakingVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken; // DAOToken
    IERC20 public immutable rewardToken;  // TaxToken

    uint256 public totalStaked;
    uint256 public rewardPerTokenStored; // scaled by 1e18
    uint256 public minLockPeriod;        // seconds

    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public stakeTimestamp;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsAdded(uint256 amount, uint256 newRewardPerToken);
    event MinLockPeriodUpdated(uint256 newPeriod);

    /// @param _stakingToken Address of DAOToken
    /// @param _rewardToken Address of TaxToken
    /// @param _owner Initial owner address
    constructor(
        address _stakingToken,
        address _rewardToken,
        address _owner
    ) Ownable(_owner) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        minLockPeriod = 7 days; // default 7-day lock
    }

    // ─── Modifiers ───────────────────────────────────────────────────

    modifier updateReward(address account) {
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ─── Views ───────────────────────────────────────────────────────

    /// @notice Calculate pending rewards for an account
    function earned(address account) public view returns (uint256) {
        return
            ((stakedBalance[account] *
                (rewardPerTokenStored - userRewardPerTokenPaid[account])) /
                1e18) + rewards[account];
    }

    function getStakedBalance(address account) external view returns (uint256) {
        return stakedBalance[account];
    }

    function getEarnedRewards(address account) external view returns (uint256) {
        return earned(account);
    }

    // ─── Staking ─────────────────────────────────────────────────────

    /// @notice Stake DAOTokens into the vault
    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "StakingVault: cannot stake 0");

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        stakedBalance[msg.sender] += amount;
        stakeTimestamp[msg.sender] = block.timestamp;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /// @notice Withdraw staked DAOTokens (subject to lock period)
    function withdraw(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "StakingVault: cannot withdraw 0");
        require(stakedBalance[msg.sender] >= amount, "StakingVault: insufficient balance");
        require(
            block.timestamp >= stakeTimestamp[msg.sender] + minLockPeriod,
            "StakingVault: lock period not elapsed"
        );

        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;

        stakingToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Claim accumulated TaxToken rewards
    function claimRewards() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "StakingVault: no rewards to claim");

        rewards[msg.sender] = 0;
        rewardToken.safeTransfer(msg.sender, reward);

        emit RewardsClaimed(msg.sender, reward);
    }

    // ─── Rewards Management ──────────────────────────────────────────

    /// @notice Called by RevenueSplitter to add TaxToken rewards to the vault.
    /// @dev Pulls tokens via transferFrom — caller must approve this contract first.
    function addRewards(uint256 amount) external {
        require(amount > 0, "StakingVault: cannot add 0 rewards");

        rewardToken.safeTransferFrom(msg.sender, address(this), amount);

        if (totalStaked > 0) {
            rewardPerTokenStored += (amount * 1e18) / totalStaked;
        }

        emit RewardsAdded(amount, rewardPerTokenStored);
    }

    // ─── Owner Setters ───────────────────────────────────────────────

    function setMinLockPeriod(uint256 _minLockPeriod) external onlyOwner {
        minLockPeriod = _minLockPeriod;
        emit MinLockPeriodUpdated(_minLockPeriod);
    }
}
