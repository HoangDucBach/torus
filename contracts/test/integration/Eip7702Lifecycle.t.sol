// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PackedUserOperation, IEntryPoint} from "@openzeppelin/contracts/interfaces/IERC4337.sol";
import {IEntryPointExtra} from "@openzeppelin/contracts/account/utils/ERC4337Utils.sol";

import {TorusVault} from "../../src/TorusVault.sol";
import {TorusPaymaster} from "../../src/TorusPaymaster.sol";

/// @notice Forked from live Arc Testnet: proves an *unmodified EOA* — via EIP-7702, with no
/// separate smart-account contract ever deployed for it — can pay ERC-4337 gas entirely out of
/// its torUSDC balance through {TorusPaymaster} on EntryPoint v0.8.
///
/// Unlike FullLifecycle.t.sol (a deployed SimpleAccount-style contract on EntryPoint v0.7), the
/// "smart account" here IS the user's own EOA address — eth-infinitism's `Simple7702Account`
/// reference implementation, already deployed on Arc at its canonical address, is temporarily
/// attached to that EOA's code via an EIP-7702 authorization (`vm.signAndAttachDelegation`).
///
/// Run with: `FOUNDRY_PROFILE=arc arc-forge test --match-contract Eip7702LifecycleTest`
contract Eip7702LifecycleTest is Test {
    IEntryPoint internal constant ENTRYPOINT_V08 = IEntryPoint(0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108);
    address internal constant SIMPLE_7702_ACCOUNT_IMPL = 0xe6Cae83BdE06E4c305530e199D7217f42808555B;

    TorusVault internal constant VAULT = TorusVault(payable(0xF87e393cdC523E69dE27e2E992225136d654273b));
    TorusPaymaster internal constant PAYMASTER_V08 =
        TorusPaymaster(payable(0xA49e84E73aE841DAc8A80CfD8fB11BD09a8B17AC));

    uint256 internal signerKey;
    address internal signer;
    address internal bundler = makeAddr("bundler");

    function setUp() public {
        string memory rpc = vm.envOr("ARC_TESTNET_RPC_URL", string("https://rpc.testnet.arc.io"));
        vm.createSelectFork(rpc);
        (signer, signerKey) = makeAddrAndKey("eip7702-user");
    }

    function test_eoaViaEip7702_paysGasEntirelyFromTorUSDC() public {
        // 1. Onboard: the (still-plain) EOA deposits native USDC into torUSDC. This one step
        // still costs native gas — it's a normal transaction, code isn't attached yet.
        vm.deal(signer, 50 ether);
        vm.prank(signer);
        uint256 shares = VAULT.depositNative{value: 50 ether}(signer);
        assertEq(shares, 50e18);
        assertEq(signer.balance, 0, "fully wrapped into torUSDC");

        // 2. EIP-7702: delegate the EOA's code to eth-infinitism's Simple7702Account, already
        // live on Arc at its canonical address — no new contract deployment, no new address.
        vm.signAndAttachDelegation(SIMPLE_7702_ACCOUNT_IMPL, signerKey);
        assertGt(signer.code.length, 0, "EOA now has delegated code");

        // 3. Submit a real UserOperation through EntryPoint v0.8, sponsored by the v0.8
        // TorusPaymaster, with zero native USDC in the account and no prior torUSDC approval
        // (the vault's gasSpender was repointed to this paymaster by DeployPaymaster.s.sol).
        address target = makeAddr("targetApp");
        bytes memory callData = abi.encodeWithSignature("execute(address,uint256,bytes)", target, uint256(0), bytes(""));

        PackedUserOperation memory userOp = _buildUserOp(callData);
        userOp.signature = _sign(userOp);

        uint256 torBalanceBefore = VAULT.balanceOf(signer);

        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;
        vm.prank(bundler);
        ENTRYPOINT_V08.handleOps(ops, payable(bundler));

        assertEq(signer.balance, 0, "EOA never needed native gas, before or after");
        uint256 torSpent = torBalanceBefore - VAULT.balanceOf(signer);
        assertGt(torSpent, 0, "gas was paid for out of torUSDC via the EIP-7702 delegation");
        assertLt(VAULT.convertToAssets(torSpent), 1e6, "sponsoring one call costs well under 1 USDC");
    }

    function _buildUserOp(bytes memory callData) internal view returns (PackedUserOperation memory userOp) {
        userOp.sender = signer;
        userOp.nonce = ENTRYPOINT_V08.getNonce(signer, 0);
        userOp.initCode = "";
        userOp.callData = callData;
        userOp.accountGasLimits = bytes32(abi.encodePacked(uint128(300_000), uint128(300_000)));
        userOp.preVerificationGas = 100_000;
        userOp.gasFees = bytes32(abi.encodePacked(uint128(1 gwei), uint128(2 gwei)));
        userOp.paymasterAndData = abi.encodePacked(address(PAYMASTER_V08), uint128(150_000), uint128(60_000));
        userOp.signature = "";
    }

    function _sign(PackedUserOperation memory userOp) internal view returns (bytes memory) {
        bytes32 userOpHash = IEntryPointExtra(address(ENTRYPOINT_V08)).getUserOpHash(userOp);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, userOpHash);
        return abi.encodePacked(r, s, v);
    }
}
