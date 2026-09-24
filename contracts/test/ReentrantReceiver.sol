// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MintPass} from "../MintPass.sol";

/// @dev Test-only: when it receives ETH (as refunded payer or as payout) it re-enters
/// `purchase` once with the ETH it just received. In `swallow` mode it catches the failure
/// and keeps the ETH; otherwise the failure bubbles up and its `receive` reverts.
contract ReentrantReceiver {
    MintPass public pass;
    bool public swallow;
    address public reentryTo;
    uint256 public reentryPlanId;
    uint256 public reentryAttempts;
    bool public reentrySucceeded;
    bytes public reentryError;

    function configure(MintPass pass_, bool swallow_, address reentryTo_, uint256 reentryPlanId_) external {
        pass = pass_;
        swallow = swallow_;
        reentryTo = reentryTo_;
        reentryPlanId = reentryPlanId_;
    }

    function purchase(address to, uint256 planId) external payable returns (uint256) {
        return pass.purchase{value: msg.value}(to, planId);
    }

    receive() external payable {
        if (address(pass) == address(0) || reentryAttempts != 0) return;
        reentryAttempts++;
        if (swallow) {
            try pass.purchase{value: msg.value}(reentryTo, reentryPlanId) {
                reentrySucceeded = true;
            } catch (bytes memory err) {
                reentryError = err;
            }
        } else {
            pass.purchase{value: msg.value}(reentryTo, reentryPlanId);
            reentrySucceeded = true;
        }
    }
}
