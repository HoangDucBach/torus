// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice Plain 6-decimal mintable ERC-20 standing in for Arc's native USDC ERC-20 interface
/// in unit tests that don't need the native/ERC-20 dual-balance behavior itself (that behavior
/// is only exercised against the real network in the forked integration test).
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
