// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IYieldStrategy
/// @notice Minimal interface a yield source must implement to be plugged into {TorusVault}.
/// @dev Push-based accounting: the vault transfers `asset()` to the strategy *before* calling
/// {deposit}, and expects the strategy to transfer `asset()` to `to` when {withdraw} is called.
/// Only the vault that owns a strategy instance is expected to call these mutating functions.
interface IYieldStrategy {
    /// @notice The ERC-20 token this strategy accepts and reports {totalAssets} in.
    function asset() external view returns (IERC20);

    /// @notice Total value (in `asset()` units) currently held/managed by the strategy.
    function totalAssets() external view returns (uint256);

    /// @notice Records `assets` of `asset()` — already transferred to this contract — as newly invested.
    function deposit(uint256 assets) external;

    /// @notice Sends `assets` of `asset()` to `to`, reducing the strategy's managed balance.
    function withdraw(uint256 assets, address to) external;
}
