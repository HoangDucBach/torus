// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TorusVault} from "../src/TorusVault.sol";
import {TorusPaymaster} from "../src/TorusPaymaster.sol";
import {MockRWAStrategy} from "../src/strategies/MockRWAStrategy.sol";

/// @notice Primes a freshly deployed Torus stack: stakes + funds the paymaster's EntryPoint
/// deposit (required before an unstaked paymaster's `_prefund` transferFrom is accepted by a
/// public-mempool bundler, per ERC-7562), and seeds the strategy's yield reserve.
///
/// Reads contract addresses from `deployments/<chainid>.json` (written by `Deploy.s.sol`)
/// unless overridden by env vars.
///
/// Usage:
///   PRIVATE_KEY=0x... STAKE_AMOUNT=1000000000000000000 DEPOSIT_AMOUNT=5000000000000000000 \
///     forge script script/Setup.s.sol --rpc-url $ARC_TESTNET_RPC_URL --broadcast
contract Setup is Script {
    using stdJson for string;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        string memory json = vm.readFile(path);

        address usdc = vm.envOr("USDC_ADDR", json.readAddress(".usdc"));
        address vaultAddr = vm.envOr("VAULT_ADDR", json.readAddress(".vault"));
        address paymasterAddr = vm.envOr("PAYMASTER_ADDR", json.readAddress(".paymaster"));
        address strategyAddr = vm.envOr("STRATEGY_ADDR", json.readAddress(".strategy"));

        uint256 unstakeDelaySec = vm.envOr("UNSTAKE_DELAY_SEC", uint256(1 days));
        uint256 stakeAmount = vm.envOr("STAKE_AMOUNT", uint256(1 ether));
        uint256 depositAmount = vm.envOr("DEPOSIT_AMOUNT", uint256(5 ether));
        uint256 reserveAmount = vm.envOr("RESERVE_AMOUNT", uint256(0));

        TorusVault vault = TorusVault(payable(vaultAddr));
        TorusPaymaster paymaster = TorusPaymaster(payable(paymasterAddr));
        MockRWAStrategy strategy = MockRWAStrategy(strategyAddr);

        vm.startBroadcast(deployerPrivateKey);

        if (stakeAmount > 0) {
            paymaster.addStake{value: stakeAmount}(uint32(unstakeDelaySec));
            console.log("Staked", stakeAmount, "wei with the EntryPoint");
        }

        if (depositAmount > 0) {
            paymaster.deposit{value: depositAmount}();
            console.log("Deposited", depositAmount, "wei to the EntryPoint");
        }

        if (reserveAmount > 0) {
            IERC20(usdc).approve(strategyAddr, reserveAmount);
            strategy.fundReserve(reserveAmount);
            console.log("Funded strategy reserve with", reserveAmount, "USDC units");
        }

        vm.stopBroadcast();

        console.log("Vault rate       :", vault.getRate());
        console.log("Paymaster deposit:", paymaster.entryPoint().balanceOf(address(paymaster)));
    }
}
