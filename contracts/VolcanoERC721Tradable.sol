// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
//import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
//import "@openzeppelin/contracts/utils/Strings.sol";
import "./VolcanoMarketplace.sol";
import "./VolcanoERC721Factory.sol";

contract VolcanoERC721Tradable is ERC721, ERC721Enumerable, ERC721URIStorage/*, Pausable*/, Ownable, ERC721Burnable, ERC2981 {

    using Counters for Counters.Counter;
    using Strings for uint256;    
    Counters.Counter private _tokenIdCounter;

    // Volcano Auction contract
    address auction;
    // Volcano Marketplace contract
    address marketplace;
    // Volcano Bundle Marketplace contract
    address bundleMarketplace;
    // Volcano ERC721 Factory contract
    address public factory;		

    bool public isprivate;
    //bool usebaseuri;    
    bool private useDecimalUri;
    string private baseUri;  
    string private baseUriExt;    
    // Opensea json metadata format interface
    string public contractURI;         

    uint256 public mintCreatorFee;
    //uint256 public mintPlatformFee;
    uint96 public creatorFeePerc;
    address payable public feeRecipient;

    uint256 public maxSupply;
    uint256 public mintStartTime;        
    uint256 public mintStopTime;

    uint256 public revealTime;
    string private preRevealUri;

    /// @dev Events of the contract
    event Minted(
        uint256 tokenId,
        address beneficiary,
        string tokenUri,
        address minter
    );
    event UpdateCreatorFee(
        uint96 creatorFeePerc
    );
    event UpdateFeeRecipient(
        address payable feeRecipient
    );

    struct contractERC721Options {
        string baseUri;
        bool useDecimalUri;        
        string baseUriExt;
        uint256 maxItems;
        uint256 mintStartTime;
        uint256 mintStopTime;
        uint256 revealTime;
        string preRevealUri;
        string contractUri;
    }    

    constructor(
        string memory _name,
        string memory _symbol,
        address _auction,
        address _marketplace,
        address _bundleMarketplace,
		address _factory,
        uint256 _mintCreatorFee,
        //uint256 _mintPlatformFee,           
        uint96 _creatorFeePerc,
        address payable _feeRecipient,
        bool _isprivate,
        contractERC721Options memory _options
    )  ERC721(_name, _symbol) {
        require(_options.mintStopTime == 0 || block.timestamp < _options.mintStopTime, "err mintStopTime");
        require(_options.mintStopTime == 0 || _options.mintStartTime < _options.mintStopTime, "err mintStopTime");
        require(_options.mintStartTime == 0 || block.timestamp < _options.mintStartTime, "err mintStartTime");
        require(_creatorFeePerc <= 10000, "invalid royalty");
        auction = _auction;
        marketplace = _marketplace;
        bundleMarketplace = _bundleMarketplace;
		factory = _factory;
        mintCreatorFee = (_isprivate ? 0 : _mintCreatorFee);
        creatorFeePerc = _creatorFeePerc;
        //mintPlatformFee = _mintPlatformFee;
        feeRecipient = _feeRecipient;
        isprivate = _isprivate;
        //usebaseuri = _usebaseuri;
        //if (_usebaseuri) {
        //    _setBaseURI(_baseUri);
        //}
        baseUri = _options.baseUri;
        useDecimalUri = _options.useDecimalUri;
        baseUriExt = _options.baseUriExt;
        maxSupply = _options.maxItems;
        mintStartTime = _options.mintStartTime;
        mintStopTime = _options.mintStopTime;    
        revealTime = _options.revealTime;
        preRevealUri = _options.preRevealUri;
        contractURI = _options.contractUri;
        _setDefaultRoyalty(msg.sender, creatorFeePerc);
    }

    /*
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
    */

    // Opensea json metadata format interface
    //function contractURI() external view returns (string memory) {
    //    return ...;
    //}    
    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }    

    /**
     @notice Method for updating platform fee
     @dev Only admin
     @param _creatorFeePerc uint96 the platform fee to set
     */
    function updateCreatorFeePerc(uint96 _creatorFeePerc) external onlyOwner {
        require(_creatorFeePerc <= 10000, "invalid royalty");
        creatorFeePerc = _creatorFeePerc;
        emit UpdateCreatorFee(_creatorFeePerc);
        _setDefaultRoyalty(feeRecipient, creatorFeePerc);
    }

    /**
     @notice Method for updating platform fee address
     @dev Only admin
     @param _feeRecipient payable address the address to sends the funds to
     */
    function updateFeeRecipient(address payable _feeRecipient)
        external
        onlyOwner
    {
        feeRecipient = _feeRecipient;
        _setDefaultRoyalty(feeRecipient, creatorFeePerc);        
        emit UpdateFeeRecipient(_feeRecipient);
    }    

    function mint(address to, string memory uri) 
        public
        //onlyOwner
        payable
    {    
       require(block.timestamp >= mintStartTime, "not started");
       require(mintStopTime == 0 || block.timestamp < mintStopTime, "ended");

        uint256 mintPlatformFee = 0;
        if (factory != address(0)) {
            VolcanoERC721Factory vfactory = VolcanoERC721Factory(payable(factory));
            mintPlatformFee = vfactory.platformMintFee();
        }
        require(msg.value == (mintCreatorFee + mintPlatformFee), "Insufficient funds to mint.");       

        if (isprivate)
            require(msg.sender == owner(), "Only owner can mint");

        require(maxSupply == 0 || _tokenIdCounter.current() < maxSupply, "Max Supply");

        uint256 tokenId = _internal_mint(to, uri);

        if (mintCreatorFee > 0) {
            (bool success,) = feeRecipient.call{ value : mintCreatorFee }("");
            require(success, "Transfer failed");
        }

        if (mintPlatformFee > 0) {
            VolcanoERC721Factory vfactory = VolcanoERC721Factory(payable(factory));
            address payable ffeeRecipient = /*vmarketplaced*/vfactory.feeRecipient();
            (bool success,) = ffeeRecipient.call{ value : mintPlatformFee }("");
            require(success, "Transfer failed");
        }

        emit Minted(tokenId, to, tokenURI(tokenId), msg.sender);
    }

    function _internal_mint(address to, string memory uri) internal returns (uint256)
    {
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(to, tokenId);
         if (bytes(baseUri).length > 0) { 
            if (useDecimalUri) {
                _setTokenURI(tokenId, string(bytes.concat(bytes(Strings.toString(tokenId)), bytes(baseUriExt))));
            } else {                
                _setTokenURI(tokenId, string(bytes.concat(bytes(toHexString(tokenId, 64)), bytes(baseUriExt))));
            }
        } else {
            _setTokenURI(tokenId, uri);
        }    
        return tokenId;
    }

    function useBaseUri() public view returns (bool) {
        return (bytes(baseUri).length > 0);
    }

    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
    function toHexString(uint256 value, uint256 length) public pure returns (string memory) {
        bytes memory buffer = new bytes(length+2);
        for (uint256 i = length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }    

    function updateContractURI(string memory _uri) public onlyOwner {
        contractURI = _uri;
    }       

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        //whenNotPaused
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        require(
            ownerOf(tokenId) == msg.sender || isApproved(tokenId, msg.sender),
            "Only owner or approved"
        );        
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        if (block.timestamp >= revealTime) {
            return super.tokenURI(tokenId);
        }
        return preRevealUri;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev checks the given token ID is approved either for all or the single token ID
     */
    function isApproved(uint256 _tokenId, address _operator) public view returns (bool) {
        return isApprovedForAll(ownerOf(_tokenId), _operator) || getApproved(_tokenId) == _operator;
    }

    /**
     * Override isApprovedForAll to whitelist Volcano contracts to enable gas-less listings.
     */
    function isApprovedForAll(address owner, address operator)
        override(ERC721, IERC721)
        public
        view
        returns (bool)
    {
        // Whitelist Volcano auction, marketplace, bundle marketplace contracts for easy trading.
        if (
            auction == operator ||
            marketplace == operator ||
            bundleMarketplace == operator
        ) {
            return true;
        }

        return super.isApprovedForAll(owner, operator);
    }

    /**
     * Override _isApprovedOrOwner to whitelist Volcano contracts to enable gas-less listings.
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) override internal view returns (bool) {
        require(_exists(tokenId), "ERC721: operator query for nonexistent token");
        address owner = ERC721.ownerOf(tokenId);
        if (isApprovedForAll(owner, spender)) return true;
        return super._isApprovedOrOwner(spender, tokenId);
    }    

    /**
     @notice View method for checking whether a token has been minted
     @param _tokenId ID of the token being checked
     */
    function exists(uint256 _tokenId) external view returns (bool) {
        return _exists(_tokenId);
    }
}


