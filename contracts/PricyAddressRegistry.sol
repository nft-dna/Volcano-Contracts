// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PricyAddressRegistry is Ownable {
    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;

    /// @notice PricyCom contract
    address public pricycom;

    /// @notice PricyAuction contract
    address public auction;

    /// @notice PricyMarketplace contract
    address public marketplace;

    /// @notice PricyBundleMarketplace contract
    address public bundleMarketplace;

    /// @notice PricyERC721Factory contract
    address public erc721factory;

    /// @notice PricyERC721FactoryPrivate contract
    address public privateErc721Factory;

    /// @notice PricyErc1155Factory contract
    address public erc1155Factory;

    /// @notice PricyErc1155FactoryPrivate contract
    address public privateErc1155Factory;

    /// @notice PricyTokenRegistry contract
    address public tokenRegistry;

    /// @notice PricyPriceFeed contract
    address public priceFeed;

    /**
     @notice Update PricyCom contract
     @dev Only admin
     */
    function updatePricyCom(address _pricycom) external onlyOwner {
        require(
            IERC165(_pricycom).supportsInterface(INTERFACE_ID_ERC721),
            "Not ERC721"
        );
        pricycom = _pricycom;
    }

    /**
     @notice Update PricyAuction contract
     @dev Only admin
     */
    function updateAuction(address _auction) external onlyOwner {
        auction = _auction;
    }

    /**
     @notice Update PricyMarketplace contract
     @dev Only admin
     */
    function updateMarketplace(address _marketplace) external onlyOwner {
        marketplace = _marketplace;
    }

    /**
     @notice Update PricyBundleMarketplace contract
     @dev Only admin
     */
    function updateBundleMarketplace(address _bundleMarketplace)
        external
        onlyOwner
    {
        bundleMarketplace = _bundleMarketplace;
    }

    /**
     @notice Update PricyErc721Factory contract
     @dev Only admin
     */
    function updateErc721Factory(address _erc721factory) external onlyOwner {
        erc721factory = _erc721factory;
    }

    /**
     @notice Update PricyErc721FactoryPrivate contract
     @dev Only admin
     */
    function updateErc721FactoryPrivate(address _privateErc721Factory)
        external
        onlyOwner
    {
        privateErc721Factory = _privateErc721Factory;
    }

    /**
     @notice Update PricyErc1155Factory contract
     @dev Only admin
     */
    function updateErc1155Factory(address _erc1155Factory) external onlyOwner {
        erc1155Factory = _erc1155Factory;
    }

    /**
     @notice Update PricyErc1155FactoryPrivate contract
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
    function updateTokenRegistry(address _tokenRegistry) external onlyOwner {
        tokenRegistry = _tokenRegistry;
    }

    /**
     @notice Update price feed contract
     @dev Only admin
     */
    function updatePriceFeed(address _priceFeed) external onlyOwner {
        priceFeed = _priceFeed;
    }
}
