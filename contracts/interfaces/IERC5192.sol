// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC-5192: Minimal Soulbound NFTs
/// @dev See https://eips.ethereum.org/EIPS/eip-5192. The ERC-165 identifier is 0xb45a3c0e.
interface IERC5192 {
    /// @notice Emitted when the locking status is changed to locked.
    /// @dev If a token is minted and the status is locked, this event should be emitted.
    event Locked(uint256 tokenId);

    /// @notice Emitted when the locking status is changed to unlocked.
    /// @dev If a token is minted and the status is unlocked, this event should be emitted.
    event Unlocked(uint256 tokenId);

    /// @notice Returns the locking status of a Soulbound Token.
    /// @dev SBTs assigned to the zero address are considered invalid, and queries about them do throw.
    function locked(uint256 tokenId) external view returns (bool);
}
