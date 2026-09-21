// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MockEntryPoint
/// @notice Minimal stand-in for the real ERC-4337 EntryPoint's {IEntryPointStake} surface,
/// installed via `vm.etch` at the canonical v0.7 address so {TorusPaymaster}'s deposit/stake
/// management can be unit-tested without forking Arc. The full `handleOps` lifecycle is
/// exercised separately against the real, forked EntryPoint in the integration test.
contract MockEntryPoint {
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public stakes;

    function balanceOf(address account) external view returns (uint256) {
        return deposits[account];
    }

    function depositTo(address account) external payable {
        deposits[account] += msg.value;
    }

    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external {
        deposits[msg.sender] -= withdrawAmount;
        (bool ok,) = withdrawAddress.call{value: withdrawAmount}("");
        require(ok, "MockEntryPoint: withdraw failed");
    }

    function addStake(
        uint32 /* unstakeDelaySec */
    )
        external
        payable
    {
        stakes[msg.sender] += msg.value;
    }

    function unlockStake() external {}

    function withdrawStake(address payable withdrawAddress) external {
        uint256 amount = stakes[msg.sender];
        stakes[msg.sender] = 0;
        (bool ok,) = withdrawAddress.call{value: amount}("");
        require(ok, "MockEntryPoint: withdraw failed");
    }
}
