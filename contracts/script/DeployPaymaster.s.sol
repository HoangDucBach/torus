// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {IEntryPoint} from "@openzeppelin/contracts/interfaces/IERC4337.sol";

import {TorusVault} from "../src/TorusVault.sol";
import {TorusPaymaster} from "../src/TorusPaymaster.sol";

/// @notice Deploys an additional {TorusPaymaster} targeting a different {IEntryPoint} version
/// against an already-deployed {TorusVault}, without touching the vault, oracle, or strategy.
///
/// Use this to add EIP-7702 support (EntryPoint v0.8) to a vault originally deployed with a
/// v0.7 paymaster (`Deploy.s.sol`'s default) — Arc has v0.7, v0.8, and v0.9 EntryPoint all live
/// at their canonical addresses, so no new EntryPoint deployment is ever needed either.
///
/// Reads the vault address from `deployments/<chainid>.json` unless VAULT_ADDR is set. Writes
/// the result under a versioned key (`paymasterV08`, etc.) in the same file, alongside the
/// existing `paymaster` entry — both remain independently usable.
///
/// Usage:
///   PRIVATE_KEY=0x... ENTRYPOINT_ADDR=0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108 \
///     forge script script/DeployPaymaster.s.sol --rpc-url $ARC_TESTNET_RPC_URL --broadcast
contract DeployPaymaster is Script {
    using stdJson for string;

    function run() external returns (TorusPaymaster paymaster) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        string memory json = vm.readFile(path);

        address vaultAddr = vm.envOr("VAULT_ADDR", json.readAddress(".vault"));
        address admin = vm.envOr("ADMIN_ADDR", deployer);
        uint16 spreadBps = uint16(vm.envOr("SPREAD_BPS", uint256(500))); // 5%
        address entryPointAddr = vm.envOr("ENTRYPOINT_ADDR", address(0));
        require(entryPointAddr != address(0), "set ENTRYPOINT_ADDR");
        bool makeGasSpender = vm.envOr("SET_AS_GAS_SPENDER", false);

        TorusVault vault = TorusVault(payable(vaultAddr));

        vm.startBroadcast(deployerPrivateKey);
        paymaster = new TorusPaymaster(vault, spreadBps, admin, IEntryPoint(entryPointAddr));
        if (makeGasSpender && admin == deployer) {
            vault.setGasSpender(address(paymaster));
        }
        vm.stopBroadcast();

        string memory suffix = vm.envOr("DEPLOYMENT_KEY_SUFFIX", string("V08"));
        vm.writeJson(vm.toString(address(paymaster)), path, string.concat(".paymaster", suffix));
        vm.writeJson(vm.toString(entryPointAddr), path, string.concat(".entryPoint", suffix));

        console.log("TorusPaymaster (new):", address(paymaster));
        console.log("  entryPoint:", entryPointAddr);
        console.log("  vault     :", vaultAddr);
        console.log("Wrote .paymaster%s / .entryPoint%s to %s", suffix, suffix, path);
        if (makeGasSpender && admin != deployer) {
            console.log("SET_AS_GAS_SPENDER requested but admin != deployer: call vault.setGasSpender manually");
        }
    }
}
