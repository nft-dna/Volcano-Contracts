// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;


import "../PricyERC721Tradable.sol";

contract MockPricyERC721Tradable is PricyERC721Tradable {

/*
PricyERC721Tradable 
        string memory _name,
        string memory _symbol,
        address _auction,
        address _marketplace,
        address _bundleMarketplace,
        uint256 _mintFee,
        uint256 _creatorFee,
        address payable _feeReceipient,
        bool _isprivate
*/
    /// @notice Contract constructor
    constructor(address payable _feeRecipient, uint256 _platformFee) 
    PricyERC721Tradable ("PricyCom", "PRY", address(0), address(0), address(0), _platformFee, 0, _feeRecipient, false) 
    {
    }

   
}