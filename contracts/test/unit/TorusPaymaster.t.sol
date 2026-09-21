// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PackedUserOperation, IPaymaster, IEntryPoint} from "@openzeppelin/contracts/interfaces/IERC4337.sol";
import {ERC4337Utils} from "@openzeppelin/contracts/account/utils/ERC4337Utils.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {TorusVault} from "../../src/TorusVault.sol";
import {TorusPaymaster} from "../../src/TorusPaymaster.sol";
import {MockRWAOracle} from "../../src/strategies/MockRWAOracle.sol";
import {MockRWAStrategy} from "../../src/strategies/MockRWAStrategy.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {MockEntryPoint} from "../mocks/MockEntryPoint.sol";
import {UserOpBuilder} from "../helpers/UserOpBuilder.sol";

contract TorusPaymasterTest is Test {
    using Math for uint256;

    address internal constant ENTRYPOINT_ADDR = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    MockUSDC internal usdc;
    MockRWAOracle internal oracle;
    MockRWAStrategy internal strategy;
    TorusVault internal vault;
    TorusPaymaster internal paymaster;
    MockEntryPoint internal entryPoint;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal owner = makeAddr("owner");
    address internal account = makeAddr("smartAccount");

    uint16 internal constant SPREAD_BPS = 500; // 5%

    function setUp() public {
        usdc = new MockUSDC();
        oracle = new MockRWAOracle(admin);
        strategy = new MockRWAStrategy(IERC20(address(usdc)), oracle, admin);
        vault = new TorusVault(IERC20(address(usdc)), strategy, treasury, 1_000, admin);

        vm.prank(admin);
        strategy.setVault(address(vault));

        paymaster = new TorusPaymaster(vault, SPREAD_BPS, owner, IEntryPoint(ENTRYPOINT_ADDR));

        vm.prank(admin);
        vault.setGasSpender(address(paymaster));

        vm.etch(ENTRYPOINT_ADDR, address(new MockEntryPoint()).code);
        entryPoint = MockEntryPoint(payable(ENTRYPOINT_ADDR));
    }

    function _giveShares(address to, uint256 assets) internal returns (uint256 shares) {
        usdc.mint(address(this), assets);
        usdc.approve(address(vault), assets);
        shares = vault.deposit(assets, to);
    }

    /// @dev Mirrors {PaymasterERC20-_erc20Cost}: `ceil(nativeCost * tokenPerNative / 1e18)`.
    function _expectedTokenCost(uint256 nativeCost, uint256 tokenPerNative) internal pure returns (uint256) {
        return nativeCost.mulDiv(tokenPerNative, 1e18, Math.Rounding.Ceil);
    }

    function _expectedTokenPerNative() internal view returns (uint256) {
        uint256 sharesPerNative = vault.previewDeposit(1e6);
        return sharesPerNative.mulDiv(BPS_DENOMINATOR + SPREAD_BPS, BPS_DENOMINATOR);
    }

    function test_entryPoint_isV07() public view {
        assertEq(address(paymaster.entryPoint()), ENTRYPOINT_ADDR);
    }

    function test_validateAndPostOp_deductsAndRefundsExpectedShares() public {
        _giveShares(account, 1_000e6); // 1000 USDC worth of torUSDC, well above any test gas cost

        uint256 maxFeePerGas = 1 gwei;
        uint256 maxCost = 0.001 ether; // 1e15 wei
        uint256 postOpGasLimit = 50_000; // > 40_000 -> triggers the unused-gas penalty model

        PackedUserOperation memory userOp =
            UserOpBuilder.build(account, address(paymaster), 60_000, postOpGasLimit, maxFeePerGas);

        uint256 tokenPerNative = _expectedTokenPerNative();
        uint256 penaltyGas = postOpGasLimit / 10; // Paymaster._postOpGasPenalty default model
        uint256 postOpCost = 30_000; // PaymasterERC20._postOpCost default
        uint256 expectedMaxTokenCost =
            _expectedTokenCost(maxCost + (postOpCost + penaltyGas) * maxFeePerGas, tokenPerNative);

        uint256 balanceBefore = vault.balanceOf(account);

        vm.prank(ENTRYPOINT_ADDR);
        (bytes memory context, uint256 validationData) =
            paymaster.validatePaymasterUserOp(userOp, bytes32(uint256(1)), maxCost);

        assertEq(validationData, ERC4337Utils.SIG_VALIDATION_SUCCESS);
        assertGt(context.length, 0);
        assertEq(
            balanceBefore - vault.balanceOf(account), expectedMaxTokenCost, "prefund pulled the expected maxTokenCost"
        );

        uint256 actualGasCost = 0.0002 ether; // less than maxCost -> refund expected
        uint256 expectedActualTokenCost =
            _expectedTokenCost(actualGasCost + (postOpCost + penaltyGas) * maxFeePerGas, tokenPerNative);

        vm.prank(ENTRYPOINT_ADDR);
        paymaster.postOp(IPaymaster.PostOpMode.opSucceeded, context, actualGasCost, maxFeePerGas);

        assertEq(
            balanceBefore - vault.balanceOf(account),
            expectedActualTokenCost,
            "final deduction matches actual gas cost, unused prefund refunded"
        );
        assertLt(expectedActualTokenCost, expectedMaxTokenCost);
    }

    function test_validate_failsClosedWhenAccountHasNoBalance() public {
        PackedUserOperation memory userOp = UserOpBuilder.build(account, address(paymaster), 60_000, 50_000, 1 gwei);

        vm.prank(ENTRYPOINT_ADDR);
        (bytes memory context, uint256 validationData) =
            paymaster.validatePaymasterUserOp(userOp, bytes32(uint256(1)), 0.001 ether);

        assertEq(validationData, ERC4337Utils.SIG_VALIDATION_FAILED);
        assertEq(context.length, 0);
    }

    function test_validate_failsWhenBelowMinTokensPerNativeFloor() public {
        _giveShares(account, 1_000e6);

        vm.prank(owner);
        paymaster.setMinTokensPerNative(type(uint128).max); // far above the real ~1e18 rate

        PackedUserOperation memory userOp = UserOpBuilder.build(account, address(paymaster), 60_000, 50_000, 1 gwei);

        vm.prank(ENTRYPOINT_ADDR);
        (bytes memory context, uint256 validationData) =
            paymaster.validatePaymasterUserOp(userOp, bytes32(uint256(1)), 0.001 ether);

        assertEq(validationData, ERC4337Utils.SIG_VALIDATION_FAILED);
        assertEq(context.length, 0);
        assertEq(vault.balanceOf(account), 1_000e18, "no funds pulled when rejected pre-prefund");
    }

    function test_onlyEntryPoint_canValidateOrPostOp() public {
        PackedUserOperation memory userOp = UserOpBuilder.build(account, address(paymaster), 60_000, 50_000, 1 gwei);
        vm.expectRevert(abi.encodeWithSignature("PaymasterUnauthorized(address)", address(this)));
        paymaster.validatePaymasterUserOp(userOp, bytes32(uint256(1)), 0.001 ether);
    }

    function test_ownerOnlyAdminFunctions_revertForNonOwner() public {
        vm.startPrank(makeAddr("rando"));
        vm.expectRevert();
        paymaster.setSpreadBps(100);
        vm.expectRevert();
        paymaster.withdraw(payable(address(this)), 1);
        vm.expectRevert();
        paymaster.addStake(0);
        vm.expectRevert();
        paymaster.withdrawTokens(IERC20(address(vault)), address(this), 1);
        vm.stopPrank();
    }

    function test_setSpreadBps_revertsAboveCeiling() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(TorusPaymaster.TorusPaymasterSpreadTooHigh.selector, 2_001));
        paymaster.setSpreadBps(2_001);
    }

    function test_deposit_fundsEntryPoint() public {
        vm.deal(address(this), 1 ether);
        paymaster.deposit{value: 1 ether}();
        assertEq(entryPoint.balanceOf(address(paymaster)), 1 ether);
    }

    function test_refuel_redeemsTorUSDCAndTopsUpEntryPointDeposit() public {
        _giveShares(address(paymaster), 100e6); // simulate spread revenue collected over time

        uint256 expectedAssets = vault.previewRedeem(vault.balanceOf(address(paymaster)));
        uint256 expectedNative = expectedAssets * paymaster.NATIVE_SCALE();

        // On real Arc, the USDC transfer inside `vault.redeem` (called by `refuel`) would also
        // credit the paymaster's native balance atomically (native and ERC-20 share one
        // ledger). `MockUSDC` cannot reproduce that here, so we credit native balance
        // explicitly, exactly as Arc's own account-unification would.
        vm.deal(address(paymaster), expectedNative);

        (uint256 assetsRedeemed, uint256 nativeDeposited) = paymaster.refuel();

        assertEq(assetsRedeemed, expectedAssets);
        assertEq(nativeDeposited, expectedNative);
        assertEq(vault.balanceOf(address(paymaster)), 0);
        assertEq(entryPoint.balanceOf(address(paymaster)), expectedNative);
    }

    function test_refuel_isNoOpWithZeroBalance() public {
        (uint256 assetsRedeemed, uint256 nativeDeposited) = paymaster.refuel();
        assertEq(assetsRedeemed, 0);
        assertEq(nativeDeposited, 0);
    }
}
