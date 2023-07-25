// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../PricyAuction.sol";

contract MockPricyAuction is PricyAuction {
    uint256 public time;

    function setTime(uint256 t) public {
        time = t;
    }

    function increaseTime(uint256 t) public {
        time += t;
    }

    function _getNow() internal override view returns (uint256) {
        return time;
    }

}
