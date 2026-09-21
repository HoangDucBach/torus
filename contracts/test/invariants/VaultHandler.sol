// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TorusVault} from "../../src/TorusVault.sol";
import {MockRWAOracle} from "../../src/strategies/MockRWAOracle.sol";
import {MockRWAStrategy} from "../../src/strategies/MockRWAStrategy.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @notice Bounded, randomized actor driving deposits, withdrawals, investing, yield accrual
/// and harvesting for the {VaultInvariants} fuzz suite.
contract VaultHandler is Test {
    MockUSDC public usdc;
    MockRWAOracle public oracle;
    MockRWAStrategy public strategy;
    TorusVault public vault;
    address public admin;

    address[] public actors;

    constructor(MockUSDC usdc_, MockRWAOracle oracle_, MockRWAStrategy strategy_, TorusVault vault_, address admin_) {
        usdc = usdc_;
        oracle = oracle_;
        strategy = strategy_;
        vault = vault_;
        admin = admin_;

        for (uint256 i = 0; i < 5; i++) {
            actors.push(makeAddr(string.concat("actor", vm.toString(i))));
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        amount = bound(amount, 1, 1_000_000e6);

        usdc.mint(actor, amount);
        vm.startPrank(actor);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, actor);
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = _actor(actorSeed);
        uint256 maxAssets = vault.maxWithdraw(actor);
        if (maxAssets == 0) return;
        amount = bound(amount, 1, maxAssets);

        // Cap by what can actually be recovered: idle vault balance + strategy principal.
        uint256 recoverable = usdc.balanceOf(address(vault)) + strategy.totalAssets();
        if (amount > recoverable) amount = recoverable;
        if (amount == 0) return;

        vm.prank(actor);
        vault.withdraw(amount, actor, actor);
    }

    function invest(uint256 amount) external {
        uint256 idle = usdc.balanceOf(address(vault));
        if (idle == 0) return;
        amount = bound(amount, 1, idle);

        vm.prank(admin);
        vault.invest(amount);
    }

    function fundReserveAndAccrueYield(uint256 reserveAmount, uint256 rateBump) external {
        reserveAmount = bound(reserveAmount, 0, 10_000e6);
        rateBump = bound(rateBump, 0, 0.2e18); // up to +20% per step

        if (reserveAmount > 0) {
            usdc.mint(address(this), reserveAmount);
            usdc.approve(address(strategy), reserveAmount);
            strategy.fundReserve(reserveAmount);
        }

        if (rateBump > 0) {
            // Compute the new rate before pranking: `vm.prank` only covers the very next call,
            // and evaluating `oracle.getRate()` as part of the argument would consume it first.
            uint256 newRate = oracle.getRate() + rateBump;
            vm.prank(admin);
            oracle.setRate(newRate);
        }

        strategy.accrue();
    }

    function harvest() external {
        vault.harvest();
    }
}
