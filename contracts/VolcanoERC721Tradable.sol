// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
//import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./VolcanoMarketplace.sol";
import "./VolcanoERC721Factory.sol";

contract VolcanoERC721Tradable is ERC721, ERC721Enumerable, ERC721URIStorage/*, Pausable*/, Ownable, ERC721Burnable {

    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;

    // Volcano Auction contract
    address auction;
    // Volcano Marketplace contract
    address marketplace;
    // Volcano Bundle Marketplace contract
    address bundleMarketplace;
    // Volcano ERC721 Factory contract
    address factory;		

    bool isprivate;
    //bool usebaseuri;    
    string public baseUri;  
    string public baseUriExt;       

    uint256 public mintCreatorFee;
    //uint256 public mintPlatformFee;
    uint256 public creatorFee;
    address payable public feeReceipient;

    uint256 public maxItems;
    uint256 public mintStartTime;        
    uint256 public mintStopTime;

    /// @dev Events of the contract
    event Minted(
        uint256 tokenId,
        address beneficiary,
        string tokenUri,
        address minter
    );
    event UpdateCreatorFee(
        uint256 creatorFee
    );
    event UpdateFeeRecipient(
        address payable feeRecipient
    );

    struct contractERC721Options {
        bool usebaseuri;
        string baseUri;
        string baseUriExt;
        uint256 maxItems;
        uint256 mintStartTime;
        uint256 mintStopTime;
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
        uint256 _creatorFee,
        address payable _feeReceipient,
        bool _isprivate,
        contractERC721Options memory _options
    )  ERC721(_name, _symbol) {
        require(_options.mintStopTime == 0 || block.timestamp < _options.mintStopTime, "err mintStopTime");
        require(_options.mintStopTime == 0 || _options.mintStartTime < _options.mintStopTime, "err mintStopTime");
        require(_options.mintStartTime == 0 || block.timestamp < _options.mintStartTime, "err mintStartTime");
        auction = _auction;
        marketplace = _marketplace;
        bundleMarketplace = _bundleMarketplace;
		factory = _factory;
        mintCreatorFee = (_isprivate ? 0 : _mintCreatorFee);
        creatorFee = _creatorFee;
        //mintPlatformFee = _mintPlatformFee;
        feeReceipient = _feeReceipient;
        isprivate = _isprivate;
        //usebaseuri = _usebaseuri;
        //if (_usebaseuri) {
        //    _setBaseURI(_baseUri);
        //}
        baseUri = _options.baseUri;
        baseUriExt = _options.baseUriExt;
        maxItems = _options.maxItems;
        mintStartTime = _options.mintStartTime;
        mintStopTime = _options.mintStopTime;        
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
     @param _creatorFee uint256 the platform fee to set
     */
    function updateCreatorFee(uint256 _creatorFee) external onlyOwner {
        creatorFee = _creatorFee;
        emit UpdateCreatorFee(_creatorFee);
    }

    /**
     @notice Method for updating platform fee address
     @dev Only admin
     @param _feeReceipient payable address the address to sends the funds to
     */
    function updateFeeRecipient(address payable _feeReceipient)
        external
        onlyOwner
    {
        feeReceipient = _feeReceipient;
        emit UpdateFeeRecipient(_feeReceipient);
    }    

    function mint(address to, string memory uri) 
        public
        //onlyOwner
        payable
    {    
       require(block.timestamp >= mintStartTime, "not started");
       require(mintStopTime == 0 || block.timestamp < mintStopTime, "ended");

       VolcanoERC721Factory vfactory = VolcanoERC721Factory(payable(factory));
       uint256 mintPlatformFee = vfactory.platformMintFee();
       require(msg.value == (mintCreatorFee + mintPlatformFee), "Insufficient funds to mint.");

        if (isprivate)
            require(msg.sender == owner(), "Only owner can mint");

        require(maxItems == 0 || _tokenIdCounter.current() < maxItems, "Max Supply");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(to, tokenId);
         if (bytes(baseUri).length > 0) {
            _setTokenURI(tokenId, string(abi.encodePacked('/', Strings.toString(tokenId), baseUriExt)));
        } else {
            _setTokenURI(tokenId, "");
        }

        if (mintCreatorFee > 0) {
            (bool success,) = feeReceipient.call{ value : mintCreatorFee }("");
            require(success, "Transfer failed");
        }

        if (mintPlatformFee > 0) {
			VolcanoMarketplace vmarketplaced = VolcanoMarketplace(payable(marketplace));
            address payable feeRecipient = vmarketplaced.feeReceipient();
            (bool success,) = feeRecipient.call{ value : mintPlatformFee }("");
            require(success, "Transfer failed");
        }

        emit Minted(tokenId, to, uri, msg.sender);
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
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
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


