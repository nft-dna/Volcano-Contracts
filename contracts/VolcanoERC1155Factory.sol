// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./VolcanoERC1155Tradable.sol";

contract VolcanoERC1155Factory is Ownable {
    /// @dev Events of the contract
    event ContractCreated(address platform, address nft, bool isprivate);
    event ContractDisabled(address caller, address nft);

    /// @notice Volcano auction contract address;
    address public auction;

    /// @notice Volcano marketplace contract address;
    address public marketplace;

    /// @notice Volcano bundle marketplace contract address;
    address public bundleMarketplace;

    /// @notice Creator fee for deploying new NFT contract
    uint256 public platformContractFee;
    address payable public feeRecipient;

    /// @notice NFT Address => Bool
    mapping(address => bool) public exists;
    mapping(address => bool) public isprivate;
	
    /// @notice platform Mint fee
    uint256 public platformMintFee;    	

    bytes4 private constant INTERFACE_ID_ERC1155 = 0xd9b67a26;

    /// @notice Contract constructor
    constructor(
        address _auction,
        address _marketplace,
        address _bundleMarketplace,
        address payable _feeRecipient,
        uint256 _platformContractFee, 
		uint256 _platformMintFee
    )  {
        auction = _auction;
        marketplace = _marketplace;
        bundleMarketplace = _bundleMarketplace;
        feeRecipient = _feeRecipient;
        platformContractFee = _platformContractFee;
        platformMintFee = _platformMintFee;		
    }

    /*
    @notice Update auction contract
    @dev Only admin
    @param _auction address the auction contract address to set
    */
    function updateAuction(address _auction) external onlyOwner {
        auction = _auction;
    }

    /**
    @notice Update marketplace contract
    @dev Only admin
    @param _marketplace address the marketplace contract address to set
    */
    function updateMarketplace(address _marketplace) external onlyOwner {
        marketplace = _marketplace;
    }

    /**
    @notice Update bundle marketplace contract
    @dev Only admin
    @param _bundleMarketplace address the bundle marketplace contract address to set
    */
    function updateBundleMarketplace(address _bundleMarketplace)
        external
        onlyOwner
    {
        bundleMarketplace = _bundleMarketplace;
    }

    /**
    @notice Update platform contract fee
    @dev Only admin
    @param _platformContractFee uint256 the platform contract fee to set
    */
    function updatePlatformContractFee(uint256 _platformContractFee) external onlyOwner {
        platformContractFee = _platformContractFee;
    }
	
    /**
    @notice Update platform mint fee
    @dev Only admin
    @param _platformMintFee uint256 the platform mint fee to set
    */    
	function updatePlatformMintFee(uint256 _platformMintFee) external onlyOwner {
        platformMintFee = _platformMintFee;
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
    }

    /// @notice Method for deploy new VolcanoERC1155Tradable contract
    /// @param _name Name of NFT contract
    /// @param _symbol Symbol of NFT contract
    function createNFTContract(
        string memory _name, 
        string memory _symbol, 
        bool _private, 
        uint256 _mintFee,       
        uint96 _creatorFeePerc,
        address payable _feeRecipient,
        VolcanoERC1155Tradable.contractERC1155Options memory _options)
        external
        payable
        returns (address)
    {
        require(msg.value == platformContractFee, "Insufficient funds.");
        if (platformContractFee > 0) {
                (bool success,) = feeRecipient.call{value: msg.value}("");
                require(success, "Transfer failed");
        }

        VolcanoERC1155Tradable nft = new VolcanoERC1155Tradable(
            _name,
            _symbol,
            auction,
            marketplace,
            bundleMarketplace,
			address(this),
            _mintFee,
            _creatorFeePerc,
            _feeRecipient,
            _private,
            _options
        );
        exists[address(nft)] = true;
        isprivate[address(nft)] = _private;
        nft.transferOwnership(_msgSender());
        emit ContractCreated(_msgSender(), address(nft), _private);
        return address(nft);
    }

    /// @notice Method for registering existing VolcanoERC1155Tradable contract
    /// @param  tokenContractAddress Address of NFT contract
    function registerTokenContract(address tokenContractAddress, bool _isprivate)
        external
        onlyOwner
    {
        require(!exists[tokenContractAddress], "NFT contract already registered");
        require(IERC165(tokenContractAddress).supportsInterface(INTERFACE_ID_ERC1155), "Not an ERC1155 contract");
        exists[tokenContractAddress] = true;
        isprivate[tokenContractAddress] = _isprivate;    
        emit ContractCreated(_msgSender(), tokenContractAddress, _isprivate);
    }

    /// @notice Method for disabling existing VolcanoERC1155Tradable contract
    /// @param  tokenContractAddress Address of NFT contract
    function disableTokenContract(address tokenContractAddress)
        external
        onlyOwner
    {
        require(exists[tokenContractAddress], "NFT contract is not registered");
        exists[tokenContractAddress] = false;
        emit ContractDisabled(_msgSender(), tokenContractAddress);
    }
}
