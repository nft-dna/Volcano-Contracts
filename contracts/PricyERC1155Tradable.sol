// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

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

    bool isprivate;   

    uint256 public mintFee;
    uint256 public creatorFee;
    address payable public feeReceipient;

    /// @dev Events of the contract
    event Minted(
        uint256 tokenId,
	uint256 amount, 
        address beneficiary,
        bytes data,
        address minter
    );
    event UpdatecreatorFee(
        uint256 creatorFee
    );
    event UpdateFeeRecipient(
        address payable feeRecipient
    );

    constructor(
        string memory _name,
        string memory _symbol,
        address _auction,
        address _marketplace,
        address _bundleMarketplace,
        uint256 _mintFee,
        uint256 _creatorFee,
        address payable _feeReceipient,
        bool _isprivate
    ) ERC1155("") {
        name = _name;
        symbol = _symbol;
        auction = _auction;
        marketplace = _marketplace;
        bundleMarketplace = _bundleMarketplace;
        mintFee = (isprivate ? 0 : _mintFee);
        creatorFee = _creatorFee;
        feeReceipient = _feeReceipient;
        isprivate = _isprivate;          
    }

    /*
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
    */

    /**
     @notice Method for updating platform fee
     @dev Only admin
     @param _creatorFee uint256 the platform fee to set
     */
    function updatecreatorFee(uint256 _creatorFee) external onlyOwner {
        creatorFee = _creatorFee;
        emit UpdatecreatorFee(_creatorFee);
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

    function mint(address account, uint256 amount, bytes memory uri)
        public
        //onlyOwner
        payable
    {
        require(msg.value == mintFee * amount, "Insufficient funds to mint.");
        if (isprivate)
            require(owner() == msg.sender, "Only owner can mint");
        
        _tokenIdCounter.increment();
        uint256 id = _tokenIdCounter.current();

        _mint(account, id, amount, uri);

        //if (bytes(uri).length > 0) {
        //    emit URI(uri, id);
        //}        

        (bool success,) = feeReceipient.call{ value : msg.value }("");
        require(success, "Transfer failed");

       emit Minted(id, amount, account, uri, msg.sender);
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
