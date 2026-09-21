// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TorusVault} from "../../src/TorusVault.sol";
import {MockRWAOracle} from "../../src/strategies/MockRWAOracle.sol";
import {MockRWAStrategy} from "../../src/strategies/MockRWAStrategy.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

contract TorusVaultTest is Test {
    uint256 internal constant NATIVE_SCALE = 1e12;

    MockUSDC internal usdc;
    MockRWAOracle internal oracle;
    MockRWAStrategy internal strategy;
    TorusVault internal vault;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal user = makeAddr("user");

    function setUp() public {
        usdc = new MockUSDC();
        oracle = new MockRWAOracle(admin);
        strategy = new MockRWAStrategy(IERC20(address(usdc)), oracle, admin);
        vault = new TorusVault(IERC20(address(usdc)), strategy, treasury, 1_000, admin); // 10% perf fee

        vm.prank(admin);
        strategy.setVault(address(vault));
    }

    /// @dev Simulates Arc's atomic native-value-credits-ERC20-balance behavior for
    /// `depositNative` unit tests: on real Arc, sending `msg.value` to a contract already
    /// increases that contract's `balanceOf` on the native USDC token because both views read
    /// the same underlying ledger. `MockUSDC` is an ordinary ERC-20 that has no such link to
    /// `vm.deal`, so we credit it explicitly right before making the same call the real chain
    /// would perform atomically.
    function _dealNative(address to, uint256 nativeWei) internal {
        vm.deal(to, to.balance + nativeWei);
        usdc.mint(address(vault), nativeWei / NATIVE_SCALE);
    }

    function test_deposit_standardERC20Flow() public {
        usdc.mint(user, 100e6);
        vm.startPrank(user);
        usdc.approve(address(vault), 100e6);
        uint256 shares = vault.deposit(100e6, user);
        vm.stopPrank();

        assertEq(shares, 100e18, "1 USDC == 1 torUSDC at genesis (18-6=12 offset)");
        assertEq(vault.balanceOf(user), 100e18);
        assertEq(vault.totalAssets(), 100e6);
    }

    function test_depositNative_mintsSharesAndEmitsEvent() public {
        uint256 nativeWei = 50 ether; // 50 native USDC units, 18 decimals
        _dealNative(user, nativeWei);

        vm.expectEmit(true, true, false, true, address(vault));
        emit TorusVaultEvents.NativeDeposited(user, user, nativeWei, 50e18);

        vm.prank(user);
        uint256 shares = vault.depositNative{value: nativeWei}(user);

        assertEq(shares, 50e18);
        assertEq(vault.balanceOf(user), 50e18);
        assertEq(vault.totalAssets(), 50e6);
    }

    function test_depositNative_revertsOnZeroAssets() public {
        // Less than 1e12 wei rounds down to 0 USDC units.
        vm.deal(user, 1);
        vm.prank(user);
        vm.expectRevert(TorusVault.TorusVaultZeroAssets.selector);
        vault.depositNative{value: 1}(user);
    }

    function test_receive_depositsNativeForSender() public {
        uint256 nativeWei = 10 ether;
        _dealNative(user, nativeWei);

        vm.prank(user);
        (bool ok,) = address(vault).call{value: nativeWei}("");
        assertTrue(ok);

        assertEq(vault.balanceOf(user), 10e18);
    }

    function test_withdraw_pullsShortfallFromStrategy() public {
        usdc.mint(user, 100e6);
        vm.startPrank(user);
        usdc.approve(address(vault), 100e6);
        vault.deposit(100e6, user);
        vm.stopPrank();

        vm.prank(admin);
        vault.invest(80e6); // only 20 USDC left idle in the vault

        vm.prank(user);
        uint256 shares = vault.withdraw(60e6, user, user);

        assertEq(shares, 60e18);
        assertEq(usdc.balanceOf(user), 60e6);
        assertEq(strategy.totalAssets(), 40e6, "strategy covered the 40 USDC shortfall");
    }

    function test_harvest_mintsFeeSharesOnYieldOnly() public {
        usdc.mint(user, 100e6);
        vm.startPrank(user);
        usdc.approve(address(vault), 100e6);
        vault.deposit(100e6, user);
        vm.stopPrank();

        vm.startPrank(admin);
        vault.invest(100e6);
        strategy.fundReserve(0); // no-op, documents that reserve funding is separate
        vm.stopPrank();

        // Fund the reserve backing yield payouts, then simulate 10% RWA growth.
        usdc.mint(address(this), 10e6);
        usdc.approve(address(strategy), 10e6);
        strategy.fundReserve(10e6);

        vm.prank(admin);
        oracle.setRate(1.1e18);
        strategy.accrue();

        uint256 treasurySharesBefore = vault.balanceOf(treasury);
        uint256 feeShares = vault.harvest();
        assertGt(feeShares, 0);
        assertEq(vault.balanceOf(treasury) - treasurySharesBefore, feeShares);

        // 10 USDC of yield at a 10% performance fee -> ~1 USDC worth of fee shares (the mint
        // dilutes the pool slightly, including the newly minted treasury shares themselves).
        assertApproxEqRel(vault.convertToAssets(feeShares), 1e6, 0.02e18);

        // A second harvest with no new yield mints nothing.
        assertEq(vault.harvest(), 0);
    }

    function test_gasSpender_hasImplicitMaxAllowance() public {
        address paymaster = makeAddr("paymaster");
        assertEq(vault.allowance(user, paymaster), 0);

        vm.prank(admin);
        vault.setGasSpender(paymaster);

        assertEq(vault.allowance(user, paymaster), type(uint256).max);
    }

    function test_setStrategy_migratesFundsToNewStrategy() public {
        usdc.mint(user, 100e6);
        vm.startPrank(user);
        usdc.approve(address(vault), 100e6);
        vault.deposit(100e6, user);
        vm.stopPrank();

        vm.startPrank(admin);
        vault.invest(100e6);

        MockRWAStrategy newStrategy = new MockRWAStrategy(IERC20(address(usdc)), oracle, admin);
        newStrategy.setVault(address(vault));
        vault.setStrategy(newStrategy);

        // setStrategy only empties the old strategy back into the vault's idle balance;
        // redeploying into the new strategy is a separate, explicit `invest` call.
        assertEq(strategy.totalAssets(), 0, "old strategy fully emptied");
        assertEq(newStrategy.totalAssets(), 0, "new strategy not yet funded");
        assertEq(vault.totalAssets(), 100e6, "funds now idle in the vault");

        vault.invest(100e6);
        vm.stopPrank();

        assertEq(newStrategy.totalAssets(), 100e6);
        assertEq(vault.totalAssets(), 100e6);
    }

    function test_getRate_startsAtOneAndGrowsWithYield() public {
        assertEq(vault.getRate(), 1e18);

        usdc.mint(user, 100e6);
        vm.startPrank(user);
        usdc.approve(address(vault), 100e6);
        vault.deposit(100e6, user);
        vm.stopPrank();

        vm.prank(admin);
        vault.invest(100e6);

        usdc.mint(address(this), 10e6);
        usdc.approve(address(strategy), 10e6);
        strategy.fundReserve(10e6);

        vm.prank(admin);
        oracle.setRate(1.1e18);
        strategy.accrue();
        vault.harvest();

        assertGt(vault.getRate(), 1e18);
    }
}

/// @dev Mirrors {ITorusVault}'s events so `vm.expectEmit` can reference them without importing
/// the whole interface namespace into the test's own scope.
interface TorusVaultEvents {
    event NativeDeposited(address indexed caller, address indexed receiver, uint256 nativeAmount, uint256 shares);
}
