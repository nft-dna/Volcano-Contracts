// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "../VolcanoAuction.sol";

contract MockVolcanoAuction is VolcanoAuction {
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
