// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./VolcanoMarketplace.sol";
import "./VolcanoERC1155Factory.sol";

contract VolcanoERC1155Tradable is ERC1155/*, Pausable*/, Ownable, ERC1155Burnable, ERC1155Supply {
    
    using Counters for Counters.Counter;
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
    address factory;	

    bool isprivate;   
    //bool usebaseuri;        

    uint256 public mintCreatorFee;
    //uint256 public mintPlatformFee;    
    uint256 public creatorFee;
    address payable public feeReceipient;

    uint256 public maxItems;
    uint256 public maxItemSupply;   
    uint256 public mintStartTime;        
    uint256 public mintStopTime;       

    /// @dev Events of the contract
    event Minted(
        uint256 tokenId,
        uint256 amount, 
        address beneficiary,
        bytes data,
        address minter
    );
    event UpdateCreatorFee(
        uint256 creatorFee
    );
    event UpdateFeeRecipient(
        address payable feeRecipient
    );

    struct contractERC1155Options {
        string baseUri;
        uint256 maxItems;
        uint256 maxItemSupply;
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
        contractERC1155Options memory _options
    ) ERC1155(_options.baseUri) {
        require(_options.mintStopTime == 0 || block.timestamp < _options.mintStopTime, "err mintStopTime");
        require(_options.mintStopTime == 0 || _options.mintStartTime < _options.mintStopTime, "err mintStopTime");
        require(_options.mintStartTime == 0 || block.timestamp < _options.mintStartTime, "err mintStartTime");        
        name = _name;
        symbol = _symbol;
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
        maxItems = _options.maxItems;     
        maxItemSupply = _options.maxItemSupply;       
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

    function mint(address account, uint256 amount, bytes memory data)
        public
        //onlyOwner
        payable
    {
       require(block.timestamp >= mintStartTime, "not started");
       require(mintStopTime == 0 || block.timestamp < mintStopTime, "ended");

       VolcanoERC1155Factory vfactory = VolcanoERC1155Factory(payable(factory));
        uint256 mintPlatformFee = vfactory.platformMintFee();
        require(msg.value == (mintCreatorFee + mintPlatformFee) /** amount*/, "Insufficient funds to mint.");
        
        if (isprivate)
            require(owner() == msg.sender, "Only owner can mint");

       require(maxItems == 0 || _tokenIdCounter.current() < maxItems, "Max Supply");
       require(maxItemSupply == 0 || amount <= maxItemSupply, "Max Item Supply");
        
        _tokenIdCounter.increment();
        uint256 id = _tokenIdCounter.current();

        _mint(account, id, amount, data);

        //if (bytes(uri).length > 0) {
        //    emit URI(uri, id);
        //}        
        if (mintCreatorFee > 0) {
            (bool success,) = feeReceipient.call{ value : mintCreatorFee /** amount*/ }("");
            require(success, "Transfer failed");
        }

        if (mintPlatformFee > 0) {
			VolcanoMarketplace vmarketplaced = VolcanoMarketplace(payable(marketplace));
            address payable feeRecipient = vmarketplaced.feeReceipient();
            (bool success,) = feeRecipient.call{ value : mintPlatformFee /** amount*/ }("");
            require(success, "Transfer failed");
        }

       emit Minted(id, amount, account, data, msg.sender);
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

}
