// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IEntryPoint} from "@openzeppelin/contracts/interfaces/IERC4337.sol";
import {ERC4337Utils} from "@openzeppelin/contracts/account/utils/ERC4337Utils.sol";
import {Account} from "@openzeppelin/contracts/account/Account.sol";
import {ERC7821} from "@openzeppelin/contracts/account/extensions/draft-ERC7821.sol";
import {SignerECDSA} from "@openzeppelin/contracts/utils/cryptography/signers/SignerECDSA.sol";

/// @title TestSmartAccount
/// @notice Minimal ERC-4337 v0.7 smart account (ECDSA signer + ERC-7821 batch executor) used
/// only by the Foundry test suite to exercise {TorusPaymaster} through a real EntryPoint,
/// mirroring what SimpleAccount/Kernel/Safe already deployed on Arc provide in production.
contract TestSmartAccount is Account, SignerECDSA, ERC7821 {
    constructor(address signerAddr) SignerECDSA(signerAddr) {}

    function entryPoint() public pure override returns (IEntryPoint) {
        return ERC4337Utils.ENTRYPOINT_V07;
    }

    function _erc7821AuthorizedExecutor(address caller, bytes32 mode, bytes calldata executionData)
        internal
        view
        override
        returns (bool)
    {
        return caller == address(entryPoint()) || super._erc7821AuthorizedExecutor(caller, mode, executionData);
    }
}
