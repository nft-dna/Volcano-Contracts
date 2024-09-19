// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^4.9.6
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "./VolcanoERC20Factory.sol";
import "./UniswapInterface.sol";

contract VolcanoERC20Token is ERC20, ERC20Burnable, Ownable, ERC20Permit, ERC20Capped {
    uint256 public initialReserves;
    uint256 public mintBlocksAmount;
    uint256 public mintBlocksFee;
    string  public uri;
    address factory;
    address public routerAddress;    
    constructor(string memory _name, 
                string memory _symbol, 
                string memory _uri,                 
                address _initialReceiver, 
                uint256 _initialAmount, 
                uint256 _capAmount, 
                uint256 _mintBlocks, 
                uint256 _mintBlocksFee,
                address _factory,
                address _routerAddress)
        ERC20(_name, _symbol)
        //Ownable(msg.sender)
        ERC20Permit(_name)
        ERC20Capped(_capAmount)
    {        
        require(_capAmount >= _initialAmount, "wrong cap amount");
        require(_mintBlocks > 0, "min blocks");
        uri = _uri;
        factory = _factory;
        initialReserves = _initialAmount;
        mintBlocksAmount = (_capAmount - _initialAmount) / _mintBlocks;
        mintBlocksFee = _mintBlocksFee;
        routerAddress = _routerAddress;
        _mint(_initialReceiver, _initialAmount);
    }

    // needed in 4.9.6
    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Capped) {
        super._mint(to, amount);
    }
    
    function mintBlock(address to) public payable {
        require(totalSupply() + (2*mintBlocksAmount) <= cap(), "capped");        
        require(msg.value == mintBlocksFee, "wrong fee");
        
        VolcanoERC20Factory vfactory = VolcanoERC20Factory(payable(factory));
        address payable feeRecipient = vfactory.feeRecipient();
        uint256 tokenFeeAmount = (mintBlocksAmount * vfactory.erc20MintTokenFeePerc()) / 1e3;

        _mint(to, mintBlocksAmount);

        if (tokenFeeAmount > 0) {
            _mint(feeRecipient, tokenFeeAmount);
        }
        _mint(address(this), mintBlocksAmount - tokenFeeAmount);
        approve(routerAddress, mintBlocksAmount - tokenFeeAmount);
        uint256 feeAmount = (mintBlocksFee * vfactory.erc20MintFeePerc()) / 1e3;
        UniswapRouterInterface(routerAddress).addLiquidityETH{ value : mintBlocksFee - feeAmount }(address(this),mintBlocksAmount - tokenFeeAmount,mintBlocksAmount - tokenFeeAmount, mintBlocksFee - feeAmount, feeRecipient,0);

        if (feeAmount > 0) {
            (bool success,) = feeRecipient.call{ value : feeAmount }("");
            require(success, "Transfer failed");                 
        }
     }

    function updateUri(string memory _uri) public onlyOwner {
        uri = _uri;
    }   

    /*
    function setRouterAddress(address _routerAddress) public onlyOwner {
        require(msg.sender == factory, "factory only");
        routerAddress = _routerAddress;
    }
    */    

    //function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Capped) {
    //    super._update(from, to, value);
    //}    
}
