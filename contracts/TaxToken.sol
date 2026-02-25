// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TaxToken
/// @notice ERC20 token with governance-controlled buy/sell tax, anti-whale limits, and trading toggle.
/// @dev After setup, ownership is transferred to the DAOTimelock so only governance can modify parameters.
contract TaxToken is ERC20, Ownable {
    uint256 public constant MAX_TAX = 2500; // 25% in basis points

    uint256 public buyTax;   // basis points (0–2500)
    uint256 public sellTax;  // basis points (0–2500)
    address public taxRecipient; // receives tax (RevenueSplitter)

    uint256 public maxTransactionAmount;
    uint256 public maxWalletAmount;
    bool public tradingEnabled;

    mapping(address => bool) public isAmmPair;
    mapping(address => bool) public isTaxExempt;
    mapping(address => bool) public isLimitExempt;

    event BuyTaxUpdated(uint256 newTax);
    event SellTaxUpdated(uint256 newTax);
    event TaxRecipientUpdated(address newRecipient);
    event MaxTransactionAmountUpdated(uint256 newAmount);
    event MaxWalletAmountUpdated(uint256 newAmount);
    event TradingEnabled(bool enabled);
    event AmmPairUpdated(address pair, bool value);
    event TaxExemptUpdated(address account, bool value);
    event LimitExemptUpdated(address account, bool value);

    /// @param _name Token name
    /// @param _symbol Token symbol
    /// @param _initialSupply Total supply minted to deployer (in whole tokens)
    /// @param _owner Initial owner address
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply,
        address _owner
    ) ERC20(_name, _symbol) Ownable(_owner) {
        uint256 supply = _initialSupply * 10 ** decimals();
        _mint(_owner, supply);

        // Default: 5% buy tax, 5% sell tax
        buyTax = 500;
        sellTax = 500;

        // Anti-whale defaults: 1% of supply per tx, 2% per wallet
        maxTransactionAmount = supply / 100;
        maxWalletAmount = (supply * 2) / 100;

        // Owner is exempt from tax and limits
        isTaxExempt[_owner] = true;
        isLimitExempt[_owner] = true;
    }

    // ─── Owner Setters ───────────────────────────────────────────────

    function setBuyTax(uint256 _buyTax) external onlyOwner {
        require(_buyTax <= MAX_TAX, "TaxToken: exceeds MAX_TAX");
        buyTax = _buyTax;
        emit BuyTaxUpdated(_buyTax);
    }

    function setSellTax(uint256 _sellTax) external onlyOwner {
        require(_sellTax <= MAX_TAX, "TaxToken: exceeds MAX_TAX");
        sellTax = _sellTax;
        emit SellTaxUpdated(_sellTax);
    }

    function setTaxRecipient(address _taxRecipient) external onlyOwner {
        taxRecipient = _taxRecipient;
        emit TaxRecipientUpdated(_taxRecipient);
    }

    function setMaxTransactionAmount(uint256 _maxTransactionAmount) external onlyOwner {
        maxTransactionAmount = _maxTransactionAmount;
        emit MaxTransactionAmountUpdated(_maxTransactionAmount);
    }

    function setMaxWalletAmount(uint256 _maxWalletAmount) external onlyOwner {
        maxWalletAmount = _maxWalletAmount;
        emit MaxWalletAmountUpdated(_maxWalletAmount);
    }

    function setTradingEnabled(bool _enabled) external onlyOwner {
        tradingEnabled = _enabled;
        emit TradingEnabled(_enabled);
    }

    function setAmmPair(address _pair, bool _value) external onlyOwner {
        isAmmPair[_pair] = _value;
        emit AmmPairUpdated(_pair, _value);
    }

    function setTaxExempt(address _account, bool _value) external onlyOwner {
        isTaxExempt[_account] = _value;
        emit TaxExemptUpdated(_account, _value);
    }

    function setLimitExempt(address _account, bool _value) external onlyOwner {
        isLimitExempt[_account] = _value;
        emit LimitExemptUpdated(_account, _value);
    }

    // ─── Core Transfer Logic ─────────────────────────────────────────

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        // Mint or burn: pass through without tax or limits
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }

        // Trading toggle: revert if neither party is exempt
        if (!tradingEnabled && !isTaxExempt[from] && !isTaxExempt[to]) {
            revert("TaxToken: trading not enabled");
        }

        bool isBuy = isAmmPair[from];
        bool isSell = isAmmPair[to];

        // Anti-whale: max transaction amount
        if (!isLimitExempt[from] && !isLimitExempt[to]) {
            require(value <= maxTransactionAmount, "TaxToken: exceeds maxTransactionAmount");
        }

        // Anti-whale: max wallet amount (skip for sells to AMM pair)
        if (!isSell && !isLimitExempt[to]) {
            require(
                balanceOf(to) + value <= maxWalletAmount,
                "TaxToken: exceeds maxWalletAmount"
            );
        }

        // Calculate tax
        uint256 taxAmount = 0;
        if (!isTaxExempt[from] && !isTaxExempt[to]) {
            if (isBuy && buyTax > 0) {
                taxAmount = (value * buyTax) / 10000;
            } else if (isSell && sellTax > 0) {
                taxAmount = (value * sellTax) / 10000;
            }
        }

        // Apply tax
        if (taxAmount > 0 && taxRecipient != address(0)) {
            super._update(from, taxRecipient, taxAmount);
            super._update(from, to, value - taxAmount);
        } else {
            super._update(from, to, value);
        }
    }
}
