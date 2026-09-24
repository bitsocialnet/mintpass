// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IERC5192} from "./interfaces/IERC5192.sol";

/**
 * @title MintPass
 * @notice A paid, soulbound, expiring pass (a MintPass, e.g. 5chan Pass or Seedit Gold). Anyone
 * can buy a pass for any address `to` (the payer and the holder may differ). The price is fixed in
 * US cents and paid in ETH, converted with a Chainlink ETH/USD feed. Buying for an address that
 * already holds a pass renews it: the same token's expiry is extended, up to {MAX_PREPAID} ahead.
 * Every address holds at most one token, forever.
 *
 * The token is permanently locked (ERC-5192): it cannot be transferred, approved or burned, and no
 * one can mint except through {purchase}. There is no owner and no admin. The only privileged
 * action is rotating the payout: {proposePayout} by the current payout, then {acceptPayout} by
 * the proposed one.
 *
 * @dev DELIBERATE DEVIATIONS FROM ERC-721 (read before integrating):
 *
 * 1. {balanceOf} reflects expiry. It returns 1 while the owner's pass is unexpired
 *    (`block.timestamp < expiresAt`) and 0 otherwise, even though the token still exists and
 *    {ownerOf} still returns the holder. Consumers that gate on `balanceOf(x) > 0` (the
 *    `erc5192-min-balance` voting rule, the EVM contract-call posting challenge) therefore honor
 *    expiry without any code change. Consequences: `balanceOf(ownerOf(id))` can be 0, the sum of
 *    balances can be lower than the number of minted tokens, and off-chain indexers that derive
 *    balances from `Transfer` events will over-count expired passes.
 * 2. The token never moves. {_update} refuses every ownership change other than a mint, so
 *    `transferFrom` and both `safeTransferFrom` overloads always revert, and there is no burn path,
 *    internal or external. {approve} and {setApprovalForAll} always revert with {Soulbound}.
 * 3. {_mint} is used instead of `_safeMint`: minting never calls into `to`. A pass minted to a
 *    contract that cannot handle ERC-721 tokens is still usable, since it never needs to move.
 */
contract MintPass is ERC721, IERC5192, ReentrancyGuardTransient {
    using Strings for uint256;

    /// @notice A purchasable plan. Immutable after deployment.
    /// @param duration Seconds of validity added per purchase.
    /// @param priceUsdCents Price in US cents (3000 = $30.00).
    struct Plan {
        uint64 duration;
        uint128 priceUsdCents;
    }

    /// @dev Packed per-holder state: one storage slot.
    struct Holder {
        uint64 tokenId;
        uint64 expiresAt;
    }

    uint256 private constant CENTS_PER_USD = 100;
    uint256 private constant WEI_PER_ETH_DECIMALS = 18;
    uint256 private constant MAX_FEED_DECIMALS = 18;

    /// @notice A pass can never be paid up more than this far ahead. Bounds what a malfunctioning
    /// price feed (a near-zero quote) could give away, since passes cannot be revoked.
    uint256 public constant MAX_PREPAID = 10 * 365 days;

    /// @notice Chainlink ETH/USD price feed (proxy) used to convert USD prices to wei.
    AggregatorV3Interface public immutable priceFeed;

    /// @notice Maximum accepted age of the feed answer, in seconds. Older answers make
    /// {quote} and {purchase} revert with {StalePrice}.
    uint256 public immutable maxStaleness;

    /// @notice Receives all proceeds. Changed only via {proposePayout} and {acceptPayout}.
    address public payout;
    /// @dev Packed into the same slot as `payout`, which every purchase reads anyway.
    uint64 private _lastTokenId;
    /// @notice The address {payout} proposed to hand over to; zero when none is pending.
    address public pendingPayout;

    Plan[] private _plans;
    mapping(address owner => Holder) private _holders;

    /// @notice Emitted on every purchase (first mint and renewal).
    /// @param paidWei The wei kept and forwarded to the payout (any excess was refunded to `payer`).
    /// @param expiresAt The pass's new expiry timestamp.
    event Purchased(
        address indexed payer,
        address indexed to,
        uint256 indexed tokenId,
        uint256 planId,
        uint256 paidWei,
        uint256 expiresAt
    );

    event PayoutProposed(address indexed currentPayout, address indexed proposedPayout);
    event PayoutChanged(address indexed previousPayout, address indexed newPayout);

    /// @dev Transfers, approvals and burns are not supported.
    error Soulbound();
    error InvalidRecipient();
    error InvalidPlan(uint256 planId);
    error InsufficientPayment(uint256 required, uint256 sent);
    error InvalidPrice(int256 answer);
    error StalePrice(uint256 updatedAt);
    error UnsupportedFeedDecimals(uint256 decimals);
    error PayoutFailed();
    error RefundFailed();
    error NotPayout(address caller);
    error NotPendingPayout(address caller);
    error PrepaidLimitExceeded(uint256 expiresAt, uint256 limit);
    error InvalidPayout(address payout);
    error InvalidFeed(address feed);
    error InvalidMaxStaleness();
    error NoPlans();
    error InvalidPlanConfig(uint256 index);

    /**
     * @param name_ ERC-721 name, e.g. "5chan Pass".
     * @param symbol_ ERC-721 symbol.
     * @param payout_ Receives all proceeds. Must not be zero or this contract.
     * @param priceFeed_ Chainlink ETH/USD feed proxy. Must be a contract answering `decimals() <= 18`.
     * @param maxStaleness_ Maximum accepted feed answer age in seconds. Must be non-zero.
     * @param plans_ Purchasable plans (plan id = array index). Non-empty; every price non-zero and
     * every duration non-zero and at most {MAX_PREPAID}.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address payout_,
        address priceFeed_,
        uint256 maxStaleness_,
        Plan[] memory plans_
    ) ERC721(name_, symbol_) {
        _requireValidPayout(payout_);
        if (priceFeed_.code.length == 0) revert InvalidFeed(priceFeed_);
        uint256 feedDecimals = AggregatorV3Interface(priceFeed_).decimals();
        if (feedDecimals > MAX_FEED_DECIMALS) revert UnsupportedFeedDecimals(feedDecimals);
        if (maxStaleness_ == 0) revert InvalidMaxStaleness();
        if (plans_.length == 0) revert NoPlans();
        for (uint256 i = 0; i < plans_.length; ++i) {
            if (plans_[i].duration == 0 || plans_[i].duration > MAX_PREPAID || plans_[i].priceUsdCents == 0) {
                revert InvalidPlanConfig(i);
            }
            _plans.push(plans_[i]);
        }

        priceFeed = AggregatorV3Interface(priceFeed_);
        maxStaleness = maxStaleness_;
        payout = payout_;
    }

    // ---------------------------------------------------------------------------------------------
    // Purchase
    // ---------------------------------------------------------------------------------------------

    /**
     * @notice Buy or renew the pass of `to` with plan `planId`, paying in ETH.
     * @dev If `to` has no pass, a new token is minted with `expiresAt = now + duration`. Otherwise the
     * existing token is renewed: `expiresAt = max(expiresAt, now) + duration`, which may not exceed
     * `now + MAX_PREPAID` (reverts with {PrepaidLimitExceeded}). Exactly the quoted wei
     * is forwarded to {payout}; any excess `msg.value` is refunded to `msg.sender`. Both transfers
     * happen after all state changes, under a reentrancy guard, and revert the purchase on failure.
     * @param to The address that holds the pass (may differ from the payer).
     * @param planId Index into {plans}.
     * @return tokenId The minted or renewed token id.
     */
    function purchase(address to, uint256 planId) external payable nonReentrant returns (uint256 tokenId) {
        if (to == address(0)) revert InvalidRecipient();
        Plan memory plan = _planAt(planId);
        uint256 required = _weiFor(plan.priceUsdCents);
        if (msg.value < required) revert InsufficientPayment(required, msg.value);

        // Effects.
        Holder memory holder = _holders[to];
        bool isNewPass = holder.tokenId == 0;
        if (isNewPass) holder.tokenId = ++_lastTokenId;
        // Renewal stacks on the remaining time; an expired (or new) pass restarts from now.
        uint256 start = Math.max(holder.expiresAt, block.timestamp);
        uint256 newExpiry = start + plan.duration;
        if (newExpiry > block.timestamp + MAX_PREPAID) revert PrepaidLimitExceeded(newExpiry, block.timestamp + MAX_PREPAID);
        holder.expiresAt = SafeCast.toUint64(newExpiry);
        _holders[to] = holder;
        tokenId = holder.tokenId;

        if (isNewPass) {
            _mint(to, tokenId); // no receiver callback into `to`
            emit Locked(tokenId);
        }
        emit Purchased(msg.sender, to, tokenId, planId, required, holder.expiresAt);

        // Interactions.
        (bool paid, ) = payout.call{value: required}("");
        if (!paid) revert PayoutFailed();
        uint256 excess = msg.value - required;
        if (excess != 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            if (!refunded) revert RefundFailed();
        }
    }

    /**
     * @notice Wei required to buy plan `planId` right now (rounded up).
     * @dev Reverts on an unknown plan or an invalid/stale feed answer. Send a small buffer on top to
     * absorb price moves before inclusion; the excess is refunded.
     */
    function quote(uint256 planId) external view returns (uint256 weiRequired) {
        return _weiFor(_planAt(planId).priceUsdCents);
    }

    /// @notice All plans; the plan id is the array index.
    function plans() external view returns (Plan[] memory) {
        return _plans;
    }

    function planCount() external view returns (uint256) {
        return _plans.length;
    }

    // ---------------------------------------------------------------------------------------------
    // Payout: the only privileged action, in two steps
    // ---------------------------------------------------------------------------------------------

    /**
     * @notice Propose handing the payout role to `newPayout`. Only the current payout can call this;
     * a new proposal replaces a pending one. Nothing changes until `newPayout` calls {acceptPayout},
     * so a mistyped address cannot capture future proceeds.
     */
    function proposePayout(address newPayout) external {
        if (msg.sender != payout) revert NotPayout(msg.sender);
        _requireValidPayout(newPayout);
        pendingPayout = newPayout;
        emit PayoutProposed(msg.sender, newPayout);
    }

    /// @notice Complete a rotation proposed by {proposePayout}. Only the proposed address can call this.
    function acceptPayout() external {
        address proposed = pendingPayout;
        // With nothing pending, `proposed` is zero and no caller can match it.
        if (msg.sender != proposed) revert NotPendingPayout(msg.sender);
        address previous = payout;
        payout = proposed;
        delete pendingPayout;
        emit PayoutChanged(previous, proposed);
    }

    // ---------------------------------------------------------------------------------------------
    // Pass views
    // ---------------------------------------------------------------------------------------------

    /// @notice Token id held by `owner`, or 0 if it never bought a pass. Token ids start at 1.
    function tokenOf(address owner) external view returns (uint256) {
        return _holders[owner].tokenId;
    }

    /// @notice Expiry timestamp of `tokenId`. The pass is valid while `block.timestamp < expiresAt`.
    /// @dev Reverts with `ERC721NonexistentToken` for a token that was never minted.
    function expiresAt(uint256 tokenId) external view returns (uint256) {
        return _holders[_requireOwned(tokenId)].expiresAt;
    }

    /// @notice Whether `owner` currently holds an unexpired pass.
    function isValid(address owner) public view returns (bool) {
        return block.timestamp < _holders[owner].expiresAt;
    }

    // ---------------------------------------------------------------------------------------------
    // ERC-721 / ERC-5192 / ERC-165
    // ---------------------------------------------------------------------------------------------

    /**
     * @notice Returns 1 if `owner` holds an UNEXPIRED pass, else 0.
     * @dev Deliberate deviation from ERC-721: expired passes still exist ({ownerOf} returns the
     * holder) but are not counted. This makes every `balanceOf`-based gate honor expiry.
     * Reverts for the zero address, as ERC-721 requires.
     */
    function balanceOf(address owner) public view override returns (uint256) {
        if (owner == address(0)) revert ERC721InvalidOwner(address(0));
        return isValid(owner) ? 1 : 0;
    }

    /// @notice Always true for existing tokens: every pass is permanently locked.
    /// @dev Reverts with `ERC721NonexistentToken` for a token that was never minted.
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    /// @dev ERC-165: ERC-5192 (0xb45a3c0e), ERC-721, ERC-721 Metadata and ERC-165.
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @notice On-chain JSON metadata (base64 data URI) with the pass's `expiresAt`.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        address owner = _requireOwned(tokenId);
        string memory passName = Strings.escapeJSON(name());
        string memory json = string.concat(
            '{"name":"',
            passName,
            " #",
            tokenId.toString(),
            '","description":"',
            passName,
            " is a MintPass. Non-transferable; counts only until expiresAt; renewable.",
            '","attributes":[{"trait_type":"expiresAt","display_type":"date","value":',
            uint256(_holders[owner].expiresAt).toString(),
            "}]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @dev Soulbound: always reverts.
    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    /// @dev Soulbound: always reverts.
    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    /**
     * @dev The single choke point for ownership changes: only a mint (no current owner) may pass.
     * `transferFrom` and both `safeTransferFrom` overloads route through here and revert with
     * {Soulbound} for any existing token (`transferFrom` to the zero address reverts earlier with
     * `ERC721InvalidReceiver`; a never-minted id reverts with `ERC721NonexistentToken`). There is
     * no burn function, and an internal `_burn`/`_transfer` would revert here too.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    // ---------------------------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------------------------

    function _planAt(uint256 planId) private view returns (Plan memory) {
        if (planId >= _plans.length) revert InvalidPlan(planId);
        return _plans[planId];
    }

    /// @dev wei = ceil(priceUsdCents * 10^18 * 10^feedDecimals / (answer * 100)).
    function _weiFor(uint256 priceUsdCents) private view returns (uint256) {
        (, int256 answer, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        if (answer <= 0) revert InvalidPrice(answer);
        if (updatedAt == 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > maxStaleness) {
            revert StalePrice(updatedAt);
        }
        // Read on every call rather than cached: the contract has no admin to fix a cached value.
        uint256 feedDecimals = priceFeed.decimals();
        if (feedDecimals > MAX_FEED_DECIMALS) revert UnsupportedFeedDecimals(feedDecimals);
        return
            Math.mulDiv(
                priceUsdCents,
                10 ** (WEI_PER_ETH_DECIMALS + feedDecimals),
                uint256(answer) * CENTS_PER_USD,
                Math.Rounding.Ceil
            );
    }

    function _requireValidPayout(address account) private view {
        if (account == address(0) || account == address(this)) revert InvalidPayout(account);
    }
}
