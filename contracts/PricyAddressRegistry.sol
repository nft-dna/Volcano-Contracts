// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

//import "@openzeppelin/contracts/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VolcanoAddressRegistry is Ownable {
    //bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;

    /// @notice VolcanoCom contract
    //address public volcanocom;

    /// @notice VolcanoAuction contract
    address public auction;

    /// @notice VolcanoMarketplace contract
    address public marketplace;

    /// @notice VolcanoBundleMarketplace contract
    address public bundleMarketplace;

    /// @notice VolcanoERC721Factory contract
    address public erc721factory;

    /// @notice VolcanoERC721FactoryPrivate contract
    address public privateErc721Factory;

    /// @notice VolcanoErc1155Factory contract
    address public erc1155Factory;

    /// @notice VolcanoErc1155FactoryPrivate contract
    address public privateErc1155Factory;

    /// @notice VolcanoTokenRegistry contract
    address public tokenRegistry;

    /// @notice VolcanoPriceFeed contract
    address public priceFeed;

    /**
     @notice Update VolcanoCom contract
     @dev Only admin

    function updateVolcanoCom(address _volcanocom) external onlyOwner {
        require(
            IERC165(_volcanocom).supportsInterface(INTERFACE_ID_ERC721),
            "Not ERC721"
        );
        volcanocom = _volcanocom;
    }
     */

    /**
     @notice Update VolcanoAuction contract
     @dev Only admin
     */
    function updateAuction(address _auction) 
        external
        onlyOwner
    {
        auction = _auction;
    }

    /**
     @notice Update VolcanoMarketplace contract
     @dev Only admin
     */
    function updateMarketplace(address _marketplace) 
        external 
        onlyOwner 
    {
        marketplace = _marketplace;
    }

    /**
     @notice Update VolcanoBundleMarketplace contract
     @dev Only admin
     */
    function updateBundleMarketplace(address _bundleMarketplace)
        external
        onlyOwner
    {
        bundleMarketplace = _bundleMarketplace;
    }

    /**
     @notice Update VolcanoErc721Factory contract
     @dev Only admin
     */
    function updateErc721Factory(address _erc721factory) 
        external 
        onlyOwner 
    {
        erc721factory = _erc721factory;
    }

    /**
     @notice Update VolcanoErc721FactoryPrivate contract
     @dev Only admin
     */
    function updateErc721FactoryPrivate(address _privateErc721Factory)
        external
        onlyOwner
    {
        privateErc721Factory = _privateErc721Factory;
    }

    /**
     @notice Update VolcanoErc1155Factory contract
     @dev Only admin
     */
    function updateErc1155Factory(address _erc1155Factory) 
        external 
        onlyOwner 
    {
        erc1155Factory = _erc1155Factory;
    }

    /**
     @notice Update VolcanoErc1155FactoryPrivate contract
     @dev Only admin
     */
    function updateErc1155FactoryPrivate(address _privateErc1155Factory)
        external
        onlyOwner
    {
        privateErc1155Factory = _privateErc1155Factory;
    }

    /**
     @notice Update token registry contract
     @dev Only admin
     */
    function updateTokenRegistry(address _tokenRegistry) 
        external 
        onlyOwner 
    {
        tokenRegistry = _tokenRegistry;
    }

    /**
     @notice Update price feed contract
     @dev Only admin
     */
    function updatePriceFeed(address _priceFeed) 
        external 
        onlyOwner 
    {
        priceFeed = _priceFeed;
    }
}
