// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IEntryPoint, PackedUserOperation} from "@openzeppelin/contracts/interfaces/IERC4337.sol";
import {ERC4337Utils} from "@openzeppelin/contracts/account/utils/ERC4337Utils.sol";
import {PaymasterERC20} from "@openzeppelin/contracts/account/paymaster/extensions/PaymasterERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ITorusVault} from "./interfaces/ITorusVault.sol";

/// @title TorusPaymaster
/// @notice ERC-4337 v0.7 paymaster that lets any smart account pay gas out of its `torUSDC`
/// balance, priced directly off {TorusVault}'s internal exchange rate — no external price
/// oracle or DEX swap is ever consulted, eliminating the FX/oracle-manipulation surface a
/// typical ERC-20 paymaster carries.
/// @dev Built on OpenZeppelin's {PaymasterERC20}, which implements the ERC-4337
/// pre-charge/refund lifecycle; this contract only supplies Torus-specific pricing
/// ({_fetchDetails}) and the self-refueling loop ({refuel}).
contract TorusPaymaster is PaymasterERC20, Ownable2Step {
    using Math for uint256;

    /// @dev Scales between Arc's native 18-decimal accounting and the 6-decimal USDC ERC-20
    /// view (same fixed ratio documented on {TorusVault.NATIVE_SCALE}).
    uint256 public constant NATIVE_SCALE = 1e12;

    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// @notice Hard ceiling on the convenience spread an owner can configure (20%).
    uint16 public constant MAX_SPREAD_BPS = 2_000;

    error TorusPaymasterZeroAddress();
    error TorusPaymasterSpreadTooHigh(uint16 spreadBps);

    event SpreadBpsUpdated(uint16 oldSpreadBps, uint16 newSpreadBps);
    event MinTokensPerNativeUpdated(uint256 oldValue, uint256 newValue);
    event Refueled(uint256 assetsRedeemed, uint256 nativeDeposited);

    ITorusVault public immutable vault;
    IERC20 public immutable torUSDC;

    /// @notice Convenience markup applied on top of the vault's exchange rate, in basis points.
    uint16 public spreadBps;

    uint256 private _minTokensPerNativeValue;

    constructor(ITorusVault vault_, uint16 spreadBps_, address owner_) Ownable(owner_) {
        if (address(vault_) == address(0) || owner_ == address(0)) revert TorusPaymasterZeroAddress();
        if (spreadBps_ > MAX_SPREAD_BPS) revert TorusPaymasterSpreadTooHigh(spreadBps_);

        vault = vault_;
        torUSDC = IERC20(address(vault_));
        spreadBps = spreadBps_;
    }

    /// @dev Targets ERC-4337 EntryPoint v0.7, the canonical instance deployed on Arc.
    function entryPoint() public pure override returns (IEntryPoint) {
        return ERC4337Utils.ENTRYPOINT_V07;
    }

    receive() external payable {}

    // ---------------------------------------------------------------------
    // PaymasterERC20 hooks
    // ---------------------------------------------------------------------

    /// @dev Prices gas purely from {TorusVault}'s internal share/asset ratio: `tokenPerNative`
    /// is the amount of torUSDC that 1 native-currency-unit (1e18 wei = 1 USDC on Arc) worth of
    /// gas costs, marked up by {spreadBps}. No oracle or AMM is read.
    function _fetchDetails(
        PackedUserOperation calldata,
        /* userOp */
        bytes32 /* userOpHash */
    )
        internal
        view
        override
        returns (uint256 validationData, IERC20 token, uint256 tokenPerNative)
    {
        uint256 sharesPerNative = vault.previewDeposit(1e6); // torUSDC minted for 1 USDC (1 native unit)
        tokenPerNative = sharesPerNative.mulDiv(BPS_DENOMINATOR + spreadBps, BPS_DENOMINATOR);
        return (ERC4337Utils.SIG_VALIDATION_SUCCESS, torUSDC, tokenPerNative);
    }

    function _minTokensPerNative() internal view override returns (uint256) {
        return _minTokensPerNativeValue;
    }

    // ---------------------------------------------------------------------
    // EntryPoint deposit/stake management (owner-authorized)
    // ---------------------------------------------------------------------

    /// @notice Tops up this paymaster's EntryPoint deposit, used to sponsor user operations.
    function deposit() external payable {
        _deposit(msg.value);
    }

    function withdraw(address payable to, uint256 value) external onlyOwner {
        _withdraw(to, value);
    }

    /// @notice Stakes native currency with the EntryPoint. Required before `_prefund`'s
    /// `transferFrom` will be accepted by public-mempool bundlers (see ERC-7562).
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        _addStake(msg.value, unstakeDelaySec);
    }

    function unlockStake() external onlyOwner {
        _unlockStake();
    }

    function withdrawStake(address payable to) external onlyOwner {
        _withdrawStake(to);
    }

    /// @notice Withdraws the torUSDC collected from the convenience spread to `to`.
    function withdrawTokens(IERC20 token, address to, uint256 amount) external onlyOwner {
        _withdrawTokens(token, to, amount);
    }

    // ---------------------------------------------------------------------
    // Self-sustaining gas loop
    // ---------------------------------------------------------------------

    /// @notice Redeems the torUSDC collected from sponsoring gas back into native USDC and
    /// deposits it with the EntryPoint, closing the loop described in the product spec.
    /// @dev Permissionless: it can only move the paymaster's own torUSDC into its own
    /// EntryPoint deposit, so anyone (typically an off-chain keeper) may call it.
    function refuel() external returns (uint256 assetsRedeemed, uint256 nativeDeposited) {
        uint256 shares = torUSDC.balanceOf(address(this));
        if (shares == 0) return (0, 0);

        assetsRedeemed = vault.redeem(shares, address(this), address(this));
        // Arc's native USDC and its ERC-20 interface share one underlying balance (see
        // TorusVault's decimal-model docs), so the ERC-20 transfer above already credited
        // this contract's native balance too — no unwrap step is needed.
        nativeDeposited = assetsRedeemed * NATIVE_SCALE;
        _deposit(nativeDeposited);

        emit Refueled(assetsRedeemed, nativeDeposited);
    }

    // ---------------------------------------------------------------------
    // Admin configuration
    // ---------------------------------------------------------------------

    function setSpreadBps(uint16 newSpreadBps) external onlyOwner {
        if (newSpreadBps > MAX_SPREAD_BPS) revert TorusPaymasterSpreadTooHigh(newSpreadBps);
        emit SpreadBpsUpdated(spreadBps, newSpreadBps);
        spreadBps = newSpreadBps;
    }

    /// @notice Floor on `tokenPerNative` below which operations are rejected outright. See
    /// {PaymasterERC20-_minTokensPerNative} for how to size this value.
    function setMinTokensPerNative(uint256 newValue) external onlyOwner {
        emit MinTokensPerNativeUpdated(_minTokensPerNativeValue, newValue);
        _minTokensPerNativeValue = newValue;
    }
}
