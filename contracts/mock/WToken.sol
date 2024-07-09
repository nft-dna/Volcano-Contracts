// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WrappedLava is ERC20 {
    constructor()
        ERC20("Wrapped Lava", "WLAVA")
    {}

    function deposit() external payable {
        require(msg.value > 0, "No funds");
        _mint(_msgSender(), msg.value);
    }	
	
    receive () external payable  {    
    }    
	
    function withdraw(uint256 amount) external {
        _burn(_msgSender(), amount);
        payable(_msgSender()).transfer(amount);
    }	
	
}