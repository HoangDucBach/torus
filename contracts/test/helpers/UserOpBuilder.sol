// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PackedUserOperation} from "@openzeppelin/contracts/interfaces/IERC4337.sol";

/// @dev Test-only helper for constructing minimal {PackedUserOperation} values, since
/// {TorusPaymaster} is exercised directly (via `vm.prank(entryPoint)`) rather than through a
/// full bundler/EntryPoint simulation in unit tests.
library UserOpBuilder {
    function build(
        address sender,
        address paymaster,
        uint256 paymasterVerificationGasLimit,
        uint256 paymasterPostOpGasLimit,
        uint256 maxFeePerGas
    ) internal pure returns (PackedUserOperation memory userOp) {
        userOp.sender = sender;
        userOp.nonce = 0;
        userOp.initCode = "";
        userOp.callData = "";
        userOp.accountGasLimits = _pack(100_000, 100_000);
        userOp.preVerificationGas = 21_000;
        userOp.gasFees = _pack(0, uint128(maxFeePerGas));
        userOp.paymasterAndData =
            abi.encodePacked(paymaster, uint128(paymasterVerificationGasLimit), uint128(paymasterPostOpGasLimit));
        userOp.signature = "";
    }

    function _pack(uint128 hi, uint128 lo) private pure returns (bytes32) {
        return bytes32(abi.encodePacked(hi, lo));
    }
}
