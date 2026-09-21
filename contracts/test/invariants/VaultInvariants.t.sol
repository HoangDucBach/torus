// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TorusVault} from "../../src/TorusVault.sol";
import {MockRWAOracle} from "../../src/strategies/MockRWAOracle.sol";
import {MockRWAStrategy} from "../../src/strategies/MockRWAStrategy.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {VaultHandler} from "./VaultHandler.sol";

contract VaultInvariantsTest is Test {
    MockUSDC internal usdc;
    MockRWAOracle internal oracle;
    MockRWAStrategy internal strategy;
    TorusVault internal vault;
    VaultHandler internal handler;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        usdc = new MockUSDC();
        oracle = new MockRWAOracle(admin);
        strategy = new MockRWAStrategy(IERC20(address(usdc)), oracle, admin);
        vault = new TorusVault(IERC20(address(usdc)), strategy, treasury, 1_000, admin);

        vm.prank(admin);
        strategy.setVault(address(vault));

        handler = new VaultHandler(usdc, oracle, strategy, vault, admin);
        targetContract(address(handler));
    }

    /// @dev The strategy must never claim to hold more than it actually does: every unit of
    /// simulated yield is backed by real, pre-funded reserve USDC, so vault withdrawals can
    /// never fail for lack of funds.
    function invariant_strategyNeverOverstatesItsBalance() public view {
        assertLe(strategy.totalAssets(), usdc.balanceOf(address(strategy)));
    }

    /// @dev totalAssets() must always equal the vault's own idle balance plus whatever the
    /// strategy reports — no value is ever created or lost by the accounting layer itself.
    function invariant_totalAssetsMatchesIdlePlusStrategy() public view {
        assertEq(vault.totalAssets(), usdc.balanceOf(address(vault)) + strategy.totalAssets());
    }

    /// @dev Round-tripping assets through shares must never manufacture value (floor rounding
    /// on both legs of a deposit-then-redeem must not let a user withdraw more than deposited).
    function invariant_shareRoundTripNeverInflatesValue() public view {
        uint256 probe = 1_000e6;
        uint256 shares = vault.convertToShares(probe);
        uint256 assetsBack = vault.convertToAssets(shares);
        assertLe(assetsBack, probe);
    }

    /// @dev The vault's exchange rate is monotonically non-decreasing: yield only ever raises
    /// it (via harvest-diluted fee shares) and principal flows leave it unchanged.
    uint256 internal _lastRate;

    function invariant_rateNeverDecreases() public {
        uint256 rate = vault.getRate();
        assertGe(rate, _lastRate);
        _lastRate = rate;
    }
}
