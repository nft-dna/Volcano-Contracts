// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^4.9.6
pragma solidity ^0.8.21;

//import "@openzeppelin/contracts@4.9.6/token/ERC20/ERC20.sol";
//import "@openzeppelin/contracts@4.9.6/token/ERC20/extensions/ERC20Burnable.sol";
//import "@openzeppelin/contracts@4.9.6/access/Ownable.sol";
//import "@openzeppelin/contracts@4.9.6/token/ERC20/extensions/ERC20Permit.sol";
//import "@openzeppelin/contracts@4.9.6/token/ERC20/extensions/ERC20Capped.sol";

interface VolcanoERC20FactoryInterface {
    function feeRecipient() external view returns (address payable);
    function erc20MintTokenFeePerc() external view returns (uint96);
    function erc20MintFeePerc() external view returns (uint96);
}

//interface VolcanoERC20TokenInterface is IERC20, IERC20Permit {
//}

interface VolcanoERC20StakingInterface {
    function fundRewards(address token, uint256 amount) external;
}
