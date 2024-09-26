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
    uint256 public mintBlocksSupply;
    uint256 public mintBlocksMaxSupply;
    // Opensea json metadata format interface
    string public contractURI;       
    address factory;
    UniswapRouterInterface public routerAddress;    

    event BlockMinted(address receiver);

    constructor(string memory _name, 
                string memory _symbol, 
                string memory _uri,                 
                address _initialReceiver, 
                uint256 _initialAmount, 
                uint256 _capAmount, 
                uint256 _mintBlocks, 
                uint256 _mintBlocksFee,
                address _factory,
                address payable _routerAddress)
        ERC20(_name, _symbol)
        //Ownable(msg.sender)
        ERC20Permit(_name)
        ERC20Capped(_capAmount)
    {        
        require(_capAmount >= _initialAmount, "wrong cap amount");
        require(_mintBlocks > 0, "mint blocks");
        contractURI = _uri;
        factory = _factory;
        initialReserves = _initialAmount;
        mintBlocksAmount = (_capAmount - _initialAmount) / (2*_mintBlocks);
        mintBlocksFee = _mintBlocksFee;
        routerAddress = UniswapRouterInterface(_routerAddress);
        _mint(_initialReceiver, _initialAmount);
        mintBlocksSupply = 0;
        mintBlocksMaxSupply = _mintBlocks;
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
        uint256 tokenFeeAmount = (mintBlocksAmount * vfactory.erc20MintTokenFeePerc()) / 10000;

        _mint(to, mintBlocksAmount);

        if (tokenFeeAmount > 0) {
            _mint(feeRecipient, tokenFeeAmount);
        }
        _mint(address(this), mintBlocksAmount - tokenFeeAmount);
        uint256 feeAmount = (mintBlocksFee * vfactory.erc20MintFeePerc()) / 10000;
        _addLiquidityETH(mintBlocksAmount - tokenFeeAmount, mintBlocksFee - feeAmount, to);

        if (feeAmount > 0) {
            (bool success,) = feeRecipient.call{ value : feeAmount }("");
            require(success, "Transfer failed");                 
        }

        mintBlocksSupply = mintBlocksSupply + 1;
        emit BlockMinted(to);
     }

    function _addLiquidityETH(
        uint amountToken,
        uint amountETH,
        address to) internal {
        _approve(address(this), address(routerAddress), amountToken);            
        routerAddress.addLiquidityETH{ value : amountETH }(address(this), amountToken, 0, 0, to, block.timestamp + 30);
    }        

    function updateContractURI(string memory _uri) public onlyOwner {
        contractURI = _uri;
    }   

    //function setRouterAddress(address _routerAddress) public onlyOwner {
    //    require(msg.sender == factory, "factory only");
    //    routerAddress = _routerAddress;
    //}  

    //function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Capped) {
    //    super._update(from, to, value);
    //}    

    // Fallback function to receive ETH
    receive() external payable {}

    // Withdraw any ETH stored in the contract
    function withdrawETH(uint256 amount) external {
        VolcanoERC20Factory vfactory = VolcanoERC20Factory(payable(factory));
        address payable feeRecipient = vfactory.feeRecipient();
        //require(msg.sender == feeRecipient, "Forbidden");        
        feeRecipient.transfer(amount);
    }    

    function withdrawTokens(uint256 amount) external {
        VolcanoERC20Factory vfactory = VolcanoERC20Factory(payable(factory));
        address payable feeRecipient = vfactory.feeRecipient();
        //require(msg.sender == feeRecipient, "Forbidden");        
        transferFrom(address(this), feeRecipient, amount);
    }      
}
