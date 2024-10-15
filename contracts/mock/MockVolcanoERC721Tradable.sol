// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;


import "../VolcanoERC721Tradable.sol";

contract MockVolcanoERC721Tradable is VolcanoERC721Tradable {

/*
    struct contractERC721Options {
        string baseUri;
        string baseUriExt;
        uint256 maxItems;
        uint256 mintStartTime;
        uint256 mintStopTime;
    } 
	
VolcanoERC721Tradable 
        string memory _name,
        string memory _symbol,
        address _auction,
        address _marketplace,
        address _bundleMarketplace,
		address _factory,
        uint256 _mintCreatorFee,
        //uint256 _mintPlatformFee,           
        uint256 _creatorFee,
        address payable _feeRecipient,
        bool _isprivate,
        contractERC721Options memory _options
*/
    /// @notice Contract constructor
    constructor(address payable _feeRecipient, uint256 _platformFee) 
    VolcanoERC721Tradable ("VolcanoCom", "PRY", address(0), address(0), address(0), address(0), _platformFee, 0, _feeRecipient, false, VolcanoERC721Tradable.contractERC721Options("", false, "", 1000, 0, 0, 0, "", "")) 
    {
    }

   
}
