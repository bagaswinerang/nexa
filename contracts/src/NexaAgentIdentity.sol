// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

/// @title NexaAgentIdentity — ERC-8004 Agent Identity as a Soulbound NFT
/// @notice One identity NFT per owner; links owner to an autonomous trading agent wallet
///         and agent metadata URI. Soulbound: Non-transferable once minted.
contract NexaAgentIdentity is ERC721 {
    error AlreadyRegistered();
    error EmptyAgentURI();
    error NotAgentOwner();
    error NonTransferable();

    uint256 public nextAgentId = 1;

    // owner address => agentId (0 = none)
    mapping(address => uint256) public agentOf;
    // agentId => trading bot wallet address (autonomous signer)
    mapping(uint256 => address) public agentWallet;
    // agentId => metadata URI (IPFS / JSON)
    mapping(uint256 => string) private _tokenURIs;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, address agentWallet, string uri);
    event AgentWalletUpdated(uint256 indexed agentId, address newWallet);
    event AgentURIUpdated(uint256 indexed agentId, string newUri);

    constructor() ERC721("Nexa Autonomous Agent", "NEXA-AGENT") {}

    /// @notice Register a new autonomous trading agent
    /// @param uri Agent specification metadata URI (IPFS/HTTPS)
    /// @param wallet Autonomous bot wallet address (0x0 => defaults to msg.sender)
    function register(string calldata uri, address wallet) external returns (uint256 agentId) {
        if (agentOf[msg.sender] != 0) revert AlreadyRegistered();
        if (bytes(uri).length == 0) revert EmptyAgentURI();

        unchecked {
            agentId = nextAgentId++;
        }

        address tradingWallet = (wallet == address(0)) ? msg.sender : wallet;

        agentOf[msg.sender] = agentId;
        agentWallet[agentId] = tradingWallet;
        _tokenURIs[agentId] = uri;

        _safeMint(msg.sender, agentId);

        emit AgentRegistered(agentId, msg.sender, tradingWallet, uri);
        emit AgentWalletUpdated(agentId, tradingWallet);
    }

    /// @notice Update agent metadata URI (only owner)
    function setAgentURI(uint256 agentId, string calldata uri) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        if (bytes(uri).length == 0) revert EmptyAgentURI();
        _tokenURIs[agentId] = uri;
        emit AgentURIUpdated(agentId, uri);
    }

    /// @notice Update agent autonomous trading wallet address (only owner)
    function setAgentWallet(uint256 agentId, address wallet) external {
        if (ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        address tradingWallet = (wallet == address(0)) ? msg.sender : wallet;
        agentWallet[agentId] = tradingWallet;
        emit AgentWalletUpdated(agentId, tradingWallet);
    }

    /// @notice Get full agent profile in one call
    function agentInfo(uint256 agentId) external view returns (address owner, address wallet, string memory uri) {
        owner = ownerOf(agentId); // Reverts automatically if token does not exist in OpenZeppelin
        return (owner, agentWallet[agentId], _tokenURIs[agentId]);
    }

    /// @notice Total agents registered on Nexa
    function totalAgents() external view returns (uint256) {
        unchecked {
            return nextAgentId - 1;
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId); // Check existence in OpenZeppelin v5
        return _tokenURIs[tokenId];
    }

    // ─── Soulbound Enforcement (OpenZeppelin v5) ────────────────────

    /// @dev Blocks transfers. Only allows minting (from == address(0)).
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // If from is not address(0), it means this is a transfer (not a mint)
        if (from != address(0)) {
            revert NonTransferable();
        }
        return super._update(to, tokenId, auth);
    }
}
