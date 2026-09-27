// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TorusVault} from "../../src/TorusVault.sol";
import {MockRWAOracle} from "../../src/strategies/MockRWAOracle.sol";
import {MockRWAStrategy} from "../../src/strategies/MockRWAStrategy.sol";

contract RevertingReceiver {
    receive() external payable {
        revert("receive() must not run on ERC-20 transfers");
    }
}

/// @notice TorusVault's `receive()` mints shares to `msg.sender`. That is only safe if an
/// ERC-20 USDC transfer *into* the vault (strategy withdrawals, redeem-to-paymaster in
/// refuel) does NOT invoke it — otherwise the strategy would be minted phantom shares.
/// This can only be checked against Arc's real native/ERC-20 unification, hence a fork test.
///
/// Run with: `FOUNDRY_PROFILE=arc arc-forge test --match-contract ArcTransferSemanticsTest`
contract ArcTransferSemanticsTest is Test {
    IERC20 internal constant USDC = IERC20(0x3600000000000000000000000000000000000000);

    function setUp() public {
        vm.createSelectFork(vm.envOr("ARC_TESTNET_RPC_URL", string("https://rpc.testnet.arc.io")));
    }

    function test_erc20TransferDoesNotInvokeReceive() public {
        address sender = makeAddr("sender");
        vm.deal(sender, 10 ether);
        RevertingReceiver receiver = new RevertingReceiver();

        vm.prank(sender);
        assertTrue(USDC.transfer(address(receiver), 1e6));
        assertEq(USDC.balanceOf(address(receiver)), 1e6);
    }

    function test_strategyWithdrawalMintsNoPhantomShares() public {
        address admin = makeAddr("admin");
        address user = makeAddr("user");
        MockRWAOracle oracle = new MockRWAOracle(admin);
        MockRWAStrategy strategy = new MockRWAStrategy(USDC, oracle, admin);
        TorusVault vault = new TorusVault(USDC, strategy, makeAddr("treasury"), 1_000, admin);
        vm.prank(admin);
        strategy.setVault(address(vault));

        vm.deal(user, 100 ether);
        vm.prank(user);
        vault.depositNative{value: 100 ether}(user);

        vm.prank(admin);
        vault.invest(100e6);

        uint256 supplyBefore = vault.totalSupply();
        uint256 shares = vault.balanceOf(user);
        vm.prank(user);
        vault.redeem(shares, user, user);

        assertEq(vault.balanceOf(address(strategy)), 0, "strategy got no shares");
        assertEq(vault.totalSupply(), supplyBefore - shares, "supply only shrank by the redeemed shares");
    }
}
