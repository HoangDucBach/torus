// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TorusVault} from "../src/TorusVault.sol";
import {TorusPaymaster} from "../src/TorusPaymaster.sol";
import {MockRWAOracle} from "../src/strategies/MockRWAOracle.sol";
import {MockRWAStrategy} from "../src/strategies/MockRWAStrategy.sol";

/// @notice Deploys the full Torus Protocol stack to Arc (testnet or mainnet — same contracts,
/// same addresses for USDC and the EntryPoint on both networks) and writes the resulting
/// addresses to `deployments/<chainid>.json` for the server and other tooling to consume.
///
/// Usage:
///   PRIVATE_KEY=0x... forge script script/Deploy.s.sol \
///     --rpc-url $ARC_TESTNET_RPC_URL --broadcast \
///     --verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/
contract Deploy is Script {
    // Same address on Arc Testnet (5042002) and Arc Mainnet (5042).
    address internal constant DEFAULT_USDC = 0x3600000000000000000000000000000000000000;

    function run()
        external
        returns (MockRWAOracle oracle, MockRWAStrategy strategy, TorusVault vault, TorusPaymaster paymaster)
    {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        address usdc = vm.envOr("USDC_ADDR", DEFAULT_USDC);
        address treasury = vm.envOr("TREASURY_ADDR", deployer);
        address admin = vm.envOr("ADMIN_ADDR", deployer);
        uint16 performanceFeeBps = uint16(vm.envOr("PERFORMANCE_FEE_BPS", uint256(1_000))); // 10%
        uint16 spreadBps = uint16(vm.envOr("SPREAD_BPS", uint256(500))); // 5%

        vm.startBroadcast(deployerPrivateKey);

        oracle = new MockRWAOracle(admin);
        strategy = new MockRWAStrategy(IERC20(usdc), oracle, admin);
        vault = new TorusVault(IERC20(usdc), strategy, treasury, performanceFeeBps, admin);
        paymaster = new TorusPaymaster(vault, spreadBps, admin);

        vm.stopBroadcast();

        // These wiring calls need the `admin` key specifically (they're `onlyRole`/`onlyOwner`),
        // which is the deployer by default but may be a separate multisig on mainnet — in that
        // case, run `Setup.s.sol` separately with the admin's own key instead.
        if (admin == deployer) {
            vm.startBroadcast(deployerPrivateKey);
            strategy.setVault(address(vault));
            vault.setGasSpender(address(paymaster));
            vm.stopBroadcast();
        } else {
            console.log("admin != deployer: run strategy.setVault + vault.setGasSpender separately");
        }

        _writeDeployment(usdc, address(oracle), address(strategy), address(vault), address(paymaster), treasury, admin);
        _logSummary(usdc, address(oracle), address(strategy), address(vault), address(paymaster));
    }

    function _writeDeployment(
        address usdc,
        address oracle,
        address strategy,
        address vault,
        address paymaster,
        address treasury,
        address admin
    ) internal {
        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "usdc", usdc);
        vm.serializeAddress(json, "entryPoint", 0x0000000071727De22E5E9d8BAf0edAc6f37da032);
        vm.serializeAddress(json, "oracle", oracle);
        vm.serializeAddress(json, "strategy", strategy);
        vm.serializeAddress(json, "vault", vault);
        vm.serializeAddress(json, "treasury", treasury);
        vm.serializeAddress(json, "admin", admin);
        string memory finalJson = vm.serializeAddress(json, "paymaster", paymaster);

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(finalJson, path);
        console.log("Wrote deployment addresses to", path);
    }

    function _logSummary(address usdc, address oracle, address strategy, address vault, address paymaster)
        internal
        pure
    {
        console.log("USDC        :", usdc);
        console.log("MockRWAOracle:", oracle);
        console.log("MockRWAStrategy:", strategy);
        console.log("TorusVault (torUSDC):", vault);
        console.log("TorusPaymaster:", paymaster);
    }
}
