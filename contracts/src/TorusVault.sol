// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ITorusVault} from "./interfaces/ITorusVault.sol";
import {IYieldStrategy} from "./interfaces/IYieldStrategy.sol";

/// @title TorusVault
/// @notice ERC-4626 vault that issues `torUSDC`, a value-accruing wrapper over Arc's native
/// USDC. Deposits placed into a pluggable {IYieldStrategy} accrue yield that raises the
/// vault's exchange rate; a small performance fee is skimmed to the treasury on {harvest}.
///
/// @dev Decimal model — Arc's native USDC uses 18 decimals while its ERC-20 interface (the
/// `asset()` of this vault) uses 6 decimals; both views read the *same* underlying balance
/// (see docs.arc.io/arc/references/evm-differences). `NATIVE_SCALE = 1e12` converts between
/// them. `torUSDC` uses a 12-decimal offset on top of the 6-decimal asset (18 decimals total),
/// which both normalizes 1 torUSDC ≈ 1 USDC at genesis and — per OpenZeppelin's ERC-4626
/// guide — makes the classic donation/inflation attack economically irrelevant.
contract TorusVault is ERC4626, ERC20Permit, AccessControl, ReentrancyGuardTransient, ITorusVault {
    using SafeERC20 for IERC20;
    using Math for uint256;

    /// @notice Role allowed to move idle assets into/out of the yield strategy.
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @dev Scales between Arc's native 18-decimal accounting and the 6-decimal ERC-20 view.
    uint256 public constant NATIVE_SCALE = 1e12;

    /// @dev Offset added on top of the asset's decimals for the share token (6 + 12 = 18).
    uint8 private constant DECIMALS_OFFSET = 12;

    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// @dev Hard ceiling on the performance fee an admin can configure (30%).
    uint16 public constant MAX_PERFORMANCE_FEE_BPS = 3_000;

    error TorusVaultZeroAssets();
    error TorusVaultZeroShares();
    error TorusVaultFeeTooHigh(uint16 feeBps);
    error TorusVaultZeroAddress();

    IYieldStrategy private _strategy;
    address public treasury;
    uint16 public performanceFeeBps;
    address public gasSpender;

    /// @dev Snapshot of {totalAssets} taken right after every deposit/withdraw/harvest, used by
    /// {harvest} to isolate strategy-generated yield from principal movements.
    uint256 private _totalAssetsCheckpoint;

    /// @dev Set for the duration of {depositNative} only, so {totalAssets} can exclude the
    /// native value just credited to this contract while share amounts are being previewed,
    /// and so {_transferIn} knows not to attempt a redundant ERC-20 pull for it.
    uint256 private transient _pendingNativeAssets;

    constructor(IERC20 usdc, IYieldStrategy strategy_, address treasury_, uint16 performanceFeeBps_, address admin)
        ERC20("Torus USDC", "torUSDC")
        ERC20Permit("Torus USDC")
        ERC4626(usdc)
    {
        if (treasury_ == address(0) || admin == address(0)) revert TorusVaultZeroAddress();
        if (performanceFeeBps_ > MAX_PERFORMANCE_FEE_BPS) revert TorusVaultFeeTooHigh(performanceFeeBps_);

        _strategy = strategy_;
        treasury = treasury_;
        performanceFeeBps = performanceFeeBps_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Native USDC entry point
    // ---------------------------------------------------------------------

    /// @inheritdoc ITorusVault
    function depositNative(address receiver) public payable nonReentrant returns (uint256 shares) {
        return _depositNative(receiver);
    }

    receive() external payable nonReentrant {
        _depositNative(_msgSender());
    }

    function _depositNative(address receiver) internal returns (uint256 shares) {
        uint256 assets = msg.value / NATIVE_SCALE;
        if (assets == 0) revert TorusVaultZeroAssets();

        // Exclude the native value already credited to this contract's balance from the
        // pre-deposit totalAssets used to price the shares.
        _pendingNativeAssets = assets;
        shares = previewDeposit(assets);
        if (shares == 0) revert TorusVaultZeroShares();

        _deposit(_msgSender(), receiver, assets, shares);
        _pendingNativeAssets = 0;

        emit NativeDeposited(_msgSender(), receiver, msg.value, shares);
    }

    /// @dev Skips the ERC-20 pull for native deposits: the assets are already sitting in this
    /// contract's balance because Arc's native USDC and its ERC-20 interface share one ledger.
    function _transferIn(address from, uint256 assets) internal override {
        if (_pendingNativeAssets > 0) return;
        super._transferIn(from, assets);
    }

    // ---------------------------------------------------------------------
    // ERC-4626 overrides
    // ---------------------------------------------------------------------

    function totalAssets() public view override(ERC4626, IERC4626) returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + _strategy.totalAssets() - _pendingNativeAssets;
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return DECIMALS_OFFSET;
    }

    function decimals() public view override(ERC4626, ERC20, IERC20Metadata) returns (uint8) {
        return super.decimals();
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        _totalAssetsCheckpoint += assets;
    }

    /// @dev Pulls any shortfall from the strategy before the standard withdraw workflow runs.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
    {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < assets) {
            _strategy.withdraw(assets - idle, address(this));
        }
        super._withdraw(caller, receiver, owner, assets, shares);
        // Saturating: `assets` can exceed the checkpoint when it includes yield not yet
        // harvested — reverting here would lock the last redeemers' funds until someone
        // calls harvest(). The unharvested portion simply goes fee-free.
        uint256 checkpoint = _totalAssetsCheckpoint;
        _totalAssetsCheckpoint = checkpoint > assets ? checkpoint - assets : 0;
    }

    // ---------------------------------------------------------------------
    // Gasless allowance for the paymaster
    // ---------------------------------------------------------------------

    /// @dev Returns `type(uint256).max` for the configured {gasSpender} so users never need to
    /// submit a separate `approve` transaction before their gas can be deducted. Safe because
    /// OpenZeppelin's `_spendAllowance` treats `type(uint256).max` as infinite and never
    /// mutates storage for it, and because the paymaster only ever pulls funds through the
    /// EntryPoint on behalf of a user operation that the account itself signed.
    function allowance(address owner_, address spender) public view override(ERC20, IERC20) returns (uint256) {
        if (spender == gasSpender && gasSpender != address(0)) return type(uint256).max;
        return super.allowance(owner_, spender);
    }

    // ---------------------------------------------------------------------
    // Yield strategy management
    // ---------------------------------------------------------------------

    function strategy() external view returns (IYieldStrategy) {
        return _strategy;
    }

    /// @notice Moves idle assets into the active strategy.
    function invest(uint256 assets) external onlyRole(MANAGER_ROLE) {
        IERC20(asset()).safeTransfer(address(_strategy), assets);
        _strategy.deposit(assets);
    }

    /// @notice Replaces the active strategy, withdrawing all funds from the old one first.
    function setStrategy(IYieldStrategy newStrategy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(newStrategy) == address(0)) revert TorusVaultZeroAddress();
        IYieldStrategy old = _strategy;
        uint256 balance = old.totalAssets();
        if (balance > 0) old.withdraw(balance, address(this));
        _strategy = newStrategy;
        emit StrategyUpdated(address(old), address(newStrategy));
    }

    /// @notice Skims a performance fee on yield accrued by the strategy since the last harvest.
    /// @dev Isolates yield from principal flows by diffing {totalAssets} against a checkpoint
    /// that is bumped by exactly `assets` on every deposit/withdraw — the only other source of
    /// change is strategy-generated yield.
    function harvest() external returns (uint256 feeShares) {
        uint256 currentAssets = totalAssets();
        if (currentAssets <= _totalAssetsCheckpoint) {
            _totalAssetsCheckpoint = currentAssets;
            return 0;
        }

        uint256 gainAssets = currentAssets - _totalAssetsCheckpoint;
        _totalAssetsCheckpoint = currentAssets;

        uint256 feeAssets = gainAssets.mulDiv(performanceFeeBps, BPS_DENOMINATOR);
        if (feeAssets > 0) {
            feeShares = convertToShares(feeAssets);
            if (feeShares > 0) _mint(treasury, feeShares);
        }

        emit PerformanceFeeAccrued(gainAssets, feeShares);
    }

    // ---------------------------------------------------------------------
    // Admin configuration
    // ---------------------------------------------------------------------

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert TorusVaultZeroAddress();
        treasury = newTreasury;
    }

    function setPerformanceFeeBps(uint16 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > MAX_PERFORMANCE_FEE_BPS) revert TorusVaultFeeTooHigh(newFeeBps);
        emit PerformanceFeeUpdated(performanceFeeBps, newFeeBps);
        performanceFeeBps = newFeeBps;
    }

    /// @dev `spender == address(0)` is a valid, intentional value: it disables the implicit
    /// max-allowance fast path entirely.
    function setGasSpender(address spender) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit GasSpenderUpdated(gasSpender, spender);
        gasSpender = spender;
    }

    /// @inheritdoc ITorusVault
    function getRate() external view returns (uint256) {
        return convertToAssets(10 ** decimals()) * NATIVE_SCALE;
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
