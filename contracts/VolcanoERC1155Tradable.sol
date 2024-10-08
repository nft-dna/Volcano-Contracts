// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol"; 
import "./VolcanoMarketplace.sol";
import "./VolcanoERC1155Factory.sol";

// uri metadata format defined in:
// https://eips.ethereum.org/EIPS/eip-1155#metadata-extensions


contract VolcanoERC1155Tradable is ERC1155/*, Pausable*/, Ownable, ERC1155Burnable, ERC1155Supply, ERC2981  {
    
    using Counters for Counters.Counter;
    using Strings for uint256;        
    Counters.Counter private _tokenIdCounter;

    // Contract name
    string public name;
    // Contract symbol
    string public symbol;    

    // Volcano Auction contract
    address auction;
    // Volcano Marketplace contract
    address marketplace;
    // Volcano Bundle Marketplace contract
    address bundleMarketplace;
    // Volcano ERC1155 Factory contract
    address public factory;	

    bool public isprivate;   
    bool private useDecimalUri;    
    bool private usebaseUriOnly;
    string private baseUri;            
    string private baseUriExt;     
    // Opensea json metadata format interface
    string public contractURI;            

    uint256 public mintCreatorFee;
    //uint256 public mintPlatformFee;    
    uint96 public creatorFeePerc;
    address payable public feeRecipient;

    uint256 public maxSupply;
    uint256 public maxItemSupply;   
    uint256 public mintStartTime;        
    uint256 public mintStopTime;   

    uint256 public revealTime;
    string private preRevealUri;        

    /// @dev Events of the contract
    event Minted(
        uint256 tokenId,
        uint256 amount, 
        address beneficiary,
        string uri,
        bytes data,
        address minter
    );
    event UpdateCreatorFee(
        uint96 creatorFeePerc
    );
    event UpdateFeeRecipient(
        address payable feeRecipient
    );

    struct contractERC1155Options {
        string baseUri;
        bool usebaseUriOnly;
        bool useDecimalUri;        
        string baseUriExt;        
        uint256 maxItems;
        uint256 maxItemSupply;
        uint256 mintStartTime;
        uint256 mintStopTime;
        uint256 revealTime;
        string preRevealUri;        
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
        contractERC1155Options memory _options
    ) ERC1155(_options.usebaseUriOnly ? _options.baseUri : string(bytes.concat(bytes(_options.baseUri), "{id}", bytes(_options.baseUriExt)))) {
        require(_options.mintStopTime == 0 || block.timestamp < _options.mintStopTime, "err mintStopTime");
        require(_options.mintStopTime == 0 || _options.mintStartTime < _options.mintStopTime, "err mintStopTime");
        require(_options.mintStartTime == 0 || block.timestamp < _options.mintStartTime, "err mintStartTime");       
        require(_creatorFeePerc <= 10000, "invalid royalty"); 
        name = _name;
        symbol = _symbol;
        auction = _auction;
        marketplace = _marketplace;
        bundleMarketplace = _bundleMarketplace;
		factory = _factory;
        mintCreatorFee = (_isprivate ? 0 : _mintCreatorFee);
        creatorFeePerc = _creatorFeePerc;
        //mintPlatformFee = _mintPlatformFee;        
        feeRecipient = _feeRecipient;
        isprivate = _isprivate;      
        usebaseUriOnly = _options.usebaseUriOnly;
        //if (_usebaseuri) {
        //    _setBaseURI(_baseUri);
        //}        
        baseUri = _options.baseUri;
        useDecimalUri = _options.useDecimalUri;
        baseUriExt = _options.baseUriExt;        
        maxSupply = _options.maxItems;     
        maxItemSupply = _options.maxItemSupply;       
        mintStartTime = _options.mintStartTime;
        mintStopTime = _options.mintStopTime;
        revealTime = _options.revealTime;
        preRevealUri = _options.preRevealUri;      
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

    // uri(uint256 id)
    /*
    The EIP says:

    The string format of the substituted hexadecimal ID MUST be lowercase alphanumeric: [0-9a-f] with no 0x prefix.
    The string format of the substituted hexadecimal ID MUST be leading zero padded to 64 hex characters length if necessary.
    So given a URI like ipfs://uri/{id}.json for token with id 250, a compliant client would have to use the last one you shared:

    ipfs://uri/00000000000000000000000000000000000000000000000000000000000000fa.json
    */
    function uri(uint256 tokenId) public view override returns (string memory) {
        if (block.timestamp >= revealTime) {
            if (usebaseUriOnly) {
                return baseUri;
            } else if (useDecimalUri) {
                return string(bytes.concat(bytes(baseUri), bytes(Strings.toString(tokenId)), bytes(baseUriExt)));
            } else {   
                return string(bytes.concat(bytes(baseUri), bytes(toHexString(tokenId, 64)), bytes(baseUriExt)));
            }
        }
        return preRevealUri;
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

    /**
     @notice Method for updating platform fee
     @dev Only admin
     @param _creatorFeePerc uint96 the platform fee to set
     */
    function updateCreatorFeePerc(uint96 _creatorFeePerc) external onlyOwner {
        require(_creatorFeePerc <= 10000, "invalid royalty");
        creatorFeePerc = _creatorFeePerc;
        _setDefaultRoyalty(feeRecipient, creatorFeePerc);
        emit UpdateCreatorFee(_creatorFeePerc);
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

    function mint(address account, uint256 amount, bytes memory data)
        public
        //onlyOwner
        payable
    {
       require(block.timestamp >= mintStartTime, "not started");
       require(mintStopTime == 0 || block.timestamp < mintStopTime, "ended");

		uint256 mintPlatformFee = 0;
		if (factory != address(0)) {
			VolcanoERC1155Factory vfactory = VolcanoERC1155Factory(payable(factory));
			mintPlatformFee = vfactory.platformMintFee();
		}
		require(msg.value == (mintCreatorFee + mintPlatformFee) /** amount*/, "Insufficient funds to mint.");
        
        if (isprivate)
            require(owner() == msg.sender, "Only owner can mint");

       require(maxSupply == 0 || _tokenIdCounter.current() < maxSupply, "Max Supply");
       require(amount > 0, "wrong amount");
       require(maxItemSupply == 0 || amount <= maxItemSupply, "Max Item Supply");
        
        _tokenIdCounter.increment();
        uint256 id = _tokenIdCounter.current();

        _mint(account, id, amount, data);

        //if (bytes(uri).length > 0) {
        //    emit URI(uri, id);
        //}        
        if (mintCreatorFee > 0) {
            (bool success,) = feeRecipient.call{ value : mintCreatorFee /** amount*/ }("");
            require(success, "Transfer failed");
        }

        if (mintPlatformFee > 0) {
            VolcanoERC1155Factory vfactory = VolcanoERC1155Factory(payable(factory));
            address payable ffeeRecipient = /*vmarketplaced*/vfactory.feeRecipient();
            (bool success,) = ffeeRecipient.call{ value : mintPlatformFee /** amount*/ }("");
            require(success, "Transfer failed");
        }

       emit Minted(id, amount, account, uri(id), data, msg.sender);
    }
 
    function itemsSupply() public view returns (uint256) {
        return _tokenIdCounter.current();
    }
    /*
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        public
        onlyOwner
    {
        _mintBatch(to, ids, amounts, data);
    }
    */

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    /**
     * Override isApprovedForAll to whitelist Volcano contracts to enable gas-less listings.
     */
    function isApprovedForAll(address _owner, address _operator)
        public
        view
        override
        returns (bool isOperator)
    {
        // Whitelist Volcano auction, marketplace, bundle marketplace contracts for easy trading.
        if (
            auction == _operator ||
            marketplace == _operator ||
            bundleMarketplace == _operator
        ) {
            return true;
        }
        return super.isApprovedForAll(_owner, _operator);
    }   

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
