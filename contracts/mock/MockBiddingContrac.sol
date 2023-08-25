// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "../PricyAuction.sol";

contract MockBiddingContract {
    PricyAuction public auctionContract;

    constructor(PricyAuction _auctionContract) {
        auctionContract = _auctionContract;
    }

    function bid(address _nftAddress, uint256 _tokenId, uint256 _bidAmount) external payable {
        auctionContract.placeBid(_nftAddress, _tokenId, _bidAmount);
    }
}
