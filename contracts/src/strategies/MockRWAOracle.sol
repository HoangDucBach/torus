// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockRWAOracle
/// @notice PoC stand-in for an off-chain-fed RWA/T-bill rate feed (e.g. a future USYC Teller
/// integration). Exposes a single monotonically non-decreasing rate, 1e18-precision, that
/// {MockRWAStrategy} uses to simulate yield accrual without any external dependency.
contract MockRWAOracle is Ownable {
    error MockRWAOracleRateDecreased(uint256 currentRate, uint256 newRate);

    event RateUpdated(uint256 previousRate, uint256 newRate);

    uint256 private _rate;

    constructor(address initialOwner) Ownable(initialOwner) {
        _rate = 1e18;
    }

    /// @notice Sets the new rate. Must never decrease, mirroring a real yield-bearing RWA index.
    function setRate(uint256 newRate) external onlyOwner {
        if (newRate < _rate) revert MockRWAOracleRateDecreased(_rate, newRate);
        emit RateUpdated(_rate, newRate);
        _rate = newRate;
    }

    /// @notice Current rate, 1e18-precision (starts at 1e18 = 1.00).
    function getRate() external view returns (uint256) {
        return _rate;
    }
}
