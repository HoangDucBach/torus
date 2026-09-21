// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PackedUserOperation, IEntryPoint} from "@openzeppelin/contracts/interfaces/IERC4337.sol";
import {IEntryPointExtra} from "@openzeppelin/contracts/account/utils/ERC4337Utils.sol";
import {Execution} from "@openzeppelin/contracts/interfaces/draft-IERC7579.sol";
import {
    ERC7579Utils,
    Mode,
    CallType,
    ExecType,
    ModeSelector,
    ModePayload
} from "@openzeppelin/contracts/account/utils/draft-ERC7579Utils.sol";

import {TorusVault} from "../../src/TorusVault.sol";
import {TorusPaymaster} from "../../src/TorusPaymaster.sol";
import {MockRWAOracle} from "../../src/strategies/MockRWAOracle.sol";
import {MockRWAStrategy} from "../../src/strategies/MockRWAStrategy.sol";
import {TestSmartAccount} from "../mocks/TestSmartAccount.sol";

/// @notice End-to-end test forked from live Arc Testnet, exercising the real, already-deployed
/// ERC-4337 v0.7 EntryPoint and Arc's native/ERC-20 USDC unification — the two chain-specific
/// behaviors that cannot be reproduced with local mocks (see the unit tests for those).
///
/// Run with: `FOUNDRY_PROFILE=arc arc-forge test --match-contract FullLifecycleTest \
///   --fork-url $ARC_TESTNET_RPC_URL`
contract FullLifecycleTest is Test {
    IERC20 internal constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    IEntryPoint internal constant ENTRYPOINT = IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032);

    MockRWAOracle internal oracle;
    MockRWAStrategy internal strategy;
    TorusVault internal vault;
    TorusPaymaster internal paymaster;
    TestSmartAccount internal account;

    uint256 internal signerKey;
    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal bundler = makeAddr("bundler");

    function setUp() public {
        string memory rpc = vm.envOr("ARC_TESTNET_RPC_URL", string("https://rpc.testnet.arc.io"));
        vm.createSelectFork(rpc);

        oracle = new MockRWAOracle(admin);
        strategy = new MockRWAStrategy(USDC, oracle, admin);
        vault = new TorusVault(USDC, strategy, treasury, 1_000, admin);

        vm.prank(admin);
        strategy.setVault(address(vault));

        paymaster = new TorusPaymaster(vault, 500, admin, ENTRYPOINT);

        vm.prank(admin);
        vault.setGasSpender(address(paymaster));

        // Stake + fund the paymaster's EntryPoint deposit, as `script/Setup.s.sol` does at
        // deploy time (required before an unstaked paymaster's `_prefund` transferFrom would be
        // accepted by a public-mempool bundler — see ERC-7562).
        vm.deal(admin, 1 ether);
        vm.prank(admin);
        paymaster.addStake{value: 1 ether}(1 days);

        vm.deal(address(this), 5 ether);
        paymaster.deposit{value: 5 ether}();

        (address signerAddr, uint256 pk) = makeAddrAndKey("signer");
        signerKey = pk;
        account = new TestSmartAccount(signerAddr);
    }

    /// @dev Confirms Arc's core precompile behavior this whole protocol is built on: native
    /// value and the USDC ERC-20 balance are the exact same underlying ledger.
    function test_nativeAndErc20ShareOneBalance() public {
        address probe = makeAddr("probe");
        vm.deal(probe, 7 ether);
        assertEq(USDC.balanceOf(probe), 7e6);
    }

    function test_depositNative_thenGaslessUserOp_sponsoredEntirelyFromYield() public {
        // 1. Fund the smart account with native USDC and wrap it into torUSDC — no ERC-20
        // approval or wrap call needed, matching the "Self-Paying Gas" UX.
        vm.deal(address(account), 50 ether);
        vm.prank(address(account));
        uint256 shares = vault.depositNative{value: 50 ether}(address(account));
        assertEq(shares, 50e18);
        assertEq(address(account).balance, 0, "native balance fully wrapped into torUSDC");

        vm.prank(admin);
        vault.invest(50e6);

        // 2. Simulate 10% RWA yield accruing, as in the product spec's walkthrough.
        _fundReserve(10e6);
        vm.prank(admin);
        oracle.setRate(1.1e18);
        strategy.accrue();
        vault.harvest();
        assertGt(vault.getRate(), 1e18);

        // 3. Build and submit a real UserOperation through the actual Arc EntryPoint, with no
        // native USDC in the account and no prior torUSDC approval to the paymaster.
        address target = makeAddr("targetApp");
        Execution[] memory calls = new Execution[](1);
        calls[0] = Execution({target: target, value: 0, callData: ""});
        bytes32 mode = Mode.unwrap(
            ERC7579Utils.encodeMode(
                ERC7579Utils.CALLTYPE_BATCH, ERC7579Utils.EXECTYPE_DEFAULT, ModeSelector.wrap(0), ModePayload.wrap(0)
            )
        );
        bytes memory callData = abi.encodeCall(account.execute, (mode, abi.encode(calls)));

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = _buildUserOp(callData);
        ops[0].signature = _sign(ops[0]);

        uint256 torBalanceBefore = vault.balanceOf(address(account));

        vm.prank(bundler);
        ENTRYPOINT.handleOps(ops, payable(bundler));

        assertEq(address(account).balance, 0, "account never needed native gas");
        uint256 torSpent = torBalanceBefore - vault.balanceOf(address(account));
        assertGt(torSpent, 0, "gas was paid for out of torUSDC");
        assertLt(vault.convertToAssets(torSpent), 1e6, "sponsoring one call costs well under 1 USDC of yield");
    }

    function _fundReserve(uint256 amount) internal {
        // Arc's USDC balance is derived directly from the account's native balance rather than
        // a conventional storage mapping, so forge-std's slot-searching `deal` cheat can't find
        // anything to overwrite here; crediting native balance is the correct way to fund it.
        vm.deal(address(this), address(this).balance + amount * 1e12);
        USDC.approve(address(strategy), amount);
        strategy.fundReserve(amount);
    }

    function _buildUserOp(bytes memory callData) internal view returns (PackedUserOperation memory userOp) {
        userOp.sender = address(account);
        userOp.nonce = ENTRYPOINT.getNonce(address(account), 0);
        userOp.initCode = "";
        userOp.callData = callData;
        userOp.accountGasLimits = bytes32(abi.encodePacked(uint128(300_000), uint128(300_000)));
        userOp.preVerificationGas = 100_000;
        userOp.gasFees = bytes32(abi.encodePacked(uint128(1 gwei), uint128(2 gwei)));
        userOp.paymasterAndData = abi.encodePacked(address(paymaster), uint128(150_000), uint128(60_000));
        userOp.signature = "";
    }

    function _sign(PackedUserOperation memory userOp) internal view returns (bytes memory) {
        // {Account-_validateUserOp} validates against the raw `userOpHash` by default (see
        // {Account-_signableUserOpHash}); no EIP-191 prefix is applied for this v0.7 EntryPoint.
        bytes32 userOpHash = IEntryPointExtra(address(ENTRYPOINT)).getUserOpHash(userOp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, userOpHash);
        return abi.encodePacked(r, s, v);
    }
}
