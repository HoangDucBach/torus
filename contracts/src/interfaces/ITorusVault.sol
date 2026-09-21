// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IYieldStrategy} from "./IYieldStrategy.sol";

/// @title ITorusVault
/// @notice ERC-4626 vault issuing `torUSDC`, extended with a native-USDC entry point and
/// the read functions the {TorusPaymaster} and off-chain services rely on.
interface ITorusVault is IERC4626 {
    /// @notice Emitted when a user deposits Arc's native USDC gas token directly.
    event NativeDeposited(address indexed caller, address indexed receiver, uint256 nativeAmount, uint256 shares);

    /// @notice Emitted by {harvest} when accrued yield is skimmed into fee shares for the treasury.
    event PerformanceFeeAccrued(uint256 gainAssets, uint256 feeShares);

    /// @notice Emitted when the yield strategy is replaced.
    event StrategyUpdated(address indexed oldStrategy, address indexed newStrategy);

    /// @notice Emitted when the address granted implicit (max) allowance for gas deduction changes.
    event GasSpenderUpdated(address indexed oldSpender, address indexed newSpender);

    /// @notice Emitted when the performance fee is updated.
    event PerformanceFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);

    /// @notice Wraps `msg.value` (Arc native USDC, 18 decimals) into `torUSDC` shares for `receiver`.
    /// @dev Arc's native USDC and its ERC-20 interface share a single underlying balance (see
    /// docs.arc.io/arc/references/evm-differences), so no separate wrap/unwrap step is required —
    /// receiving `msg.value` already credits this contract's ERC-20 `balanceOf`.
    function depositNative(address receiver) external payable returns (uint256 shares);

    /// @notice Skims performance fees on yield accrued by the strategy since the last call.
    /// @return feeShares The amount of `torUSDC` minted to the treasury.
    function harvest() external returns (uint256 feeShares);

    /// @notice Current exchange rate, expressed as asset-equivalent-per-share scaled to 1e18
    /// (i.e. `1e18` at genesis, growing as yield accrues).
    function getRate() external view returns (uint256);

    /// @notice The address (expected to be the {TorusPaymaster}) granted an implicit maximum
    /// allowance so users never need to submit a separate `approve` transaction for gas.
    function gasSpender() external view returns (address);

    /// @notice The active yield strategy.
    function strategy() external view returns (IYieldStrategy);
}
