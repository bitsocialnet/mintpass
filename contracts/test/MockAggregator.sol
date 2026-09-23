// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

/// @dev Test-only Chainlink aggregator with fully settable round data.
contract MockAggregator is AggregatorV3Interface {
    uint8 public decimals;
    string public description = "ETH / USD (mock)";
    uint256 public constant version = 4;

    uint80 private _roundId;
    int256 private _answer;
    uint256 private _updatedAt;
    bool public shouldRevert;

    constructor(uint8 decimals_, int256 answer_) {
        decimals = decimals_;
        setAnswer(answer_);
    }

    /// @dev New round with `answer_`, updated now.
    function setAnswer(int256 answer_) public {
        setRound(answer_, block.timestamp);
    }

    function setRound(int256 answer_, uint256 updatedAt_) public {
        _roundId++;
        _answer = answer_;
        _updatedAt = updatedAt_;
    }

    function setDecimals(uint8 decimals_) external {
        decimals = decimals_;
    }

    function setShouldRevert(bool shouldRevert_) external {
        shouldRevert = shouldRevert_;
    }

    function getRoundData(uint80)
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return latestRoundData();
    }

    function latestRoundData()
        public
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        require(!shouldRevert, "MockAggregator: reverted");
        return (_roundId, _answer, _updatedAt, _updatedAt, _roundId);
    }
}
