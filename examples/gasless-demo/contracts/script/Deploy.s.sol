// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {ExampleCounter} from "../src/ExampleCounter.sol";

contract Deploy is Script {
    function run() external returns (ExampleCounter counter) {
        vm.startBroadcast();
        counter = new ExampleCounter();
        vm.stopBroadcast();

        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        string memory finalJson = vm.serializeAddress(json, "counter", address(counter));
        vm.writeJson(finalJson, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }
}
