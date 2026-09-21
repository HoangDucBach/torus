// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IYieldStrategy} from "../interfaces/IYieldStrategy.sol";
import {MockRWAOracle} from "./MockRWAOracle.sol";

/// @title MockRWAStrategy
/// @notice PoC yield strategy standing in for a real-world-asset venue (e.g. a future
/// `USYCStrategy` built on Circle's USYC Teller). Growth of {MockRWAOracle}'s rate is
/// converted into real USDC yield by moving pre-funded `reserve` balance into `principal`,
/// so {TorusVault} withdrawals are always backed 1:1 by an actual token balance and can
/// never fail for lack of funds.
contract MockRWAStrategy is IYieldStrategy, Ownable {
    using SafeERC20 for IERC20;

    error MockRWAStrategyUnauthorizedVault(address caller);
    error MockRWAStrategyVaultAlreadySet();
    error MockRWAStrategyZeroAddress();
    error MockRWAStrategyInsufficientPrincipal(uint256 requested, uint256 available);

    event VaultSet(address indexed vault);
    event ReserveFunded(address indexed from, uint256 amount);
    event Accrued(uint256 rateFrom, uint256 rateTo, uint256 yieldAssets);

    IERC20 public immutable asset;
    MockRWAOracle public immutable oracle;

    address public vault;
    uint256 public principal;
    uint256 public lastRate;

    modifier onlyVault() {
        if (msg.sender != vault) revert MockRWAStrategyUnauthorizedVault(msg.sender);
        _;
    }

    constructor(IERC20 asset_, MockRWAOracle oracle_, address initialOwner) Ownable(initialOwner) {
        asset = asset_;
        oracle = oracle_;
        lastRate = oracle_.getRate();
    }

    /// @notice One-time binding to the vault allowed to call {deposit}/{withdraw}.
    function setVault(address vault_) external onlyOwner {
        if (vault_ == address(0)) revert MockRWAStrategyZeroAddress();
        if (vault != address(0)) revert MockRWAStrategyVaultAlreadySet();
        vault = vault_;
        emit VaultSet(vault_);
    }

    /// @notice Funds the reserve backing future yield payouts. Anyone may top this up.
    function fundReserve(uint256 amount) external {
        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(msg.sender, amount);
    }

    /// @notice Idle reserve not yet counted as principal/yield.
    function reserve() external view returns (uint256) {
        return asset.balanceOf(address(this)) - principal;
    }

    // ---------------------------------------------------------------------
    // IYieldStrategy
    // ---------------------------------------------------------------------

    function totalAssets() external view returns (uint256) {
        return principal;
    }

    /// @dev Assumes `assets` of `asset()` have already been transferred to this contract by the vault.
    function deposit(uint256 assets) external onlyVault {
        principal += assets;
    }

    function withdraw(uint256 assets, address to) external onlyVault {
        if (assets > principal) revert MockRWAStrategyInsufficientPrincipal(assets, principal);
        unchecked {
            principal -= assets;
        }
        asset.safeTransfer(to, assets);
    }

    // ---------------------------------------------------------------------
    // Yield simulation
    // ---------------------------------------------------------------------

    /// @notice Converts oracle rate growth since the last call into real yield, capped by the
    /// reserve actually funded, and adds it to `principal`. Permissionless — safe to call by
    /// anyone (e.g. the off-chain keeper) since it can only ever move value in the vault's favor.
    function accrue() external returns (uint256 yieldAssets) {
        uint256 rateFrom = lastRate;
        uint256 rateTo = oracle.getRate();
        if (rateTo <= rateFrom) return 0;

        yieldAssets = (principal * (rateTo - rateFrom)) / 1e18;
        uint256 availableReserve = asset.balanceOf(address(this)) - principal;
        if (yieldAssets > availableReserve) yieldAssets = availableReserve;

        lastRate = rateTo;
        if (yieldAssets == 0) return 0;

        principal += yieldAssets;
        emit Accrued(rateFrom, rateTo, yieldAssets);
    }
}
