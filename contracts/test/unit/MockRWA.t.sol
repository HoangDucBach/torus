// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MockRWAOracle} from "../../src/strategies/MockRWAOracle.sol";
import {MockRWAStrategy} from "../../src/strategies/MockRWAStrategy.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract MockRWAOracleTest is Test {
    MockRWAOracle internal oracle;
    address internal owner = makeAddr("owner");

    function setUp() public {
        oracle = new MockRWAOracle(owner);
    }

    function test_startsAtOnePointZero() public view {
        assertEq(oracle.getRate(), 1e18);
    }

    function test_ownerCanIncreaseRate() public {
        vm.prank(owner);
        oracle.setRate(1.05e18);
        assertEq(oracle.getRate(), 1.05e18);
    }

    function test_revertsOnDecrease() public {
        vm.startPrank(owner);
        oracle.setRate(1.05e18);
        vm.expectRevert(abi.encodeWithSelector(MockRWAOracle.MockRWAOracleRateDecreased.selector, 1.05e18, 1.0e18));
        oracle.setRate(1.0e18);
        vm.stopPrank();
    }

    function test_revertsForNonOwner() public {
        vm.expectRevert();
        oracle.setRate(1.1e18);
    }
}

contract MockRWAStrategyTest is Test {
    MockUSDC internal usdc;
    MockRWAOracle internal oracle;
    MockRWAStrategy internal strategy;

    address internal owner = makeAddr("owner");
    address internal vault = makeAddr("vault");

    function setUp() public {
        usdc = new MockUSDC();
        oracle = new MockRWAOracle(owner);
        strategy = new MockRWAStrategy(IERC20(address(usdc)), oracle, owner);

        vm.prank(owner);
        strategy.setVault(vault);
    }

    function test_setVault_onlyOnce() public {
        vm.startPrank(owner);
        vm.expectRevert(MockRWAStrategy.MockRWAStrategyVaultAlreadySet.selector);
        strategy.setVault(makeAddr("other"));
        vm.stopPrank();
    }

    function test_deposit_onlyVault() public {
        usdc.mint(address(strategy), 100e6);
        vm.expectRevert(
            abi.encodeWithSelector(MockRWAStrategy.MockRWAStrategyUnauthorizedVault.selector, address(this))
        );
        strategy.deposit(100e6);

        vm.prank(vault);
        strategy.deposit(100e6);
        assertEq(strategy.totalAssets(), 100e6);
    }

    function test_withdraw_onlyVaultAndCapped() public {
        usdc.mint(address(strategy), 100e6);
        vm.prank(vault);
        strategy.deposit(100e6);

        vm.prank(vault);
        vm.expectRevert(
            abi.encodeWithSelector(MockRWAStrategy.MockRWAStrategyInsufficientPrincipal.selector, 101e6, 100e6)
        );
        strategy.withdraw(101e6, vault);

        vm.prank(vault);
        strategy.withdraw(40e6, vault);
        assertEq(strategy.totalAssets(), 60e6);
        assertEq(usdc.balanceOf(vault), 40e6);
    }

    function test_fundReserve_isPermissionless() public {
        address rando = makeAddr("rando");
        usdc.mint(rando, 5e6);
        vm.startPrank(rando);
        usdc.approve(address(strategy), 5e6);
        strategy.fundReserve(5e6);
        vm.stopPrank();

        assertEq(strategy.reserve(), 5e6);
    }

    function test_accrue_movesRateGrowthFromReserveToPrincipal() public {
        usdc.mint(address(strategy), 100e6);
        vm.prank(vault);
        strategy.deposit(100e6);

        usdc.mint(address(this), 10e6);
        usdc.approve(address(strategy), 10e6);
        strategy.fundReserve(10e6);

        vm.prank(owner);
        oracle.setRate(1.1e18); // +10%

        uint256 yieldAssets = strategy.accrue();
        assertEq(yieldAssets, 10e6);
        assertEq(strategy.totalAssets(), 110e6);
        assertEq(strategy.reserve(), 0);
    }

    function test_accrue_capsAtAvailableReserve() public {
        usdc.mint(address(strategy), 100e6);
        vm.prank(vault);
        strategy.deposit(100e6);

        // Only 2 USDC funded, even though the rate implies 10 USDC of yield.
        usdc.mint(address(this), 2e6);
        usdc.approve(address(strategy), 2e6);
        strategy.fundReserve(2e6);

        vm.prank(owner);
        oracle.setRate(1.1e18);

        uint256 yieldAssets = strategy.accrue();
        assertEq(yieldAssets, 2e6, "capped by the funded reserve");
        assertEq(strategy.totalAssets(), 102e6);
    }

    function test_accrue_isNoOpWithoutRateGrowth() public {
        assertEq(strategy.accrue(), 0);
    }
}
