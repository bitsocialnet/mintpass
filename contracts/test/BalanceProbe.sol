// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MintPass} from "../MintPass.sol";

/// @dev Test-only: records `balanceOf`/`isValid` inside a mined transaction, so tests can check
/// the expiry boundary at an exact block timestamp.
contract BalanceProbe {
    uint256 public lastTimestamp;
    uint256 public lastBalance;
    bool public lastValid;

    function record(MintPass pass, address holder) external {
        lastTimestamp = block.timestamp;
        lastBalance = pass.balanceOf(holder);
        lastValid = pass.isValid(holder);
    }
}
