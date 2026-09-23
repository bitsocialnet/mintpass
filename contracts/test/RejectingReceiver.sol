// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {MintPass} from "../MintPass.sol";

/// @dev Test-only: a payer/payout contract whose `receive` reverts while `rejecting` is true.
contract RejectingReceiver {
    bool public rejecting = true;

    function setRejecting(bool rejecting_) external {
        rejecting = rejecting_;
    }

    function purchase(MintPass pass, address to, uint256 planId) external payable returns (uint256) {
        return pass.purchase{value: msg.value}(to, planId);
    }

    function setPayout(MintPass pass, address newPayout) external {
        pass.setPayout(newPayout);
    }

    receive() external payable {
        require(!rejecting, "RejectingReceiver: rejected");
    }
}
