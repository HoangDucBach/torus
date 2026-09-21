// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Stand-in for an unrelated third-party protocol's contract. It has no knowledge of
/// Torus at all — the point of this example is that a normal contract like this one can be
/// called gaslessly by any account that pays through TorusPaymaster, with zero integration work
/// on the contract's own side.
contract ExampleCounter {
    uint256 public count;
    address public lastCaller;

    event Incremented(address indexed caller, uint256 newCount);

    function increment() external returns (uint256) {
        count += 1;
        lastCaller = msg.sender;
        emit Incremented(msg.sender, count);
        return count;
    }
}
