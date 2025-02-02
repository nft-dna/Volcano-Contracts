// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^4.9.6
pragma solidity ^0.8.21;

import "@openzeppelin/contracts@4.9.6/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts@4.9.6/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts@4.9.6/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.6/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts@4.9.6/token/ERC20/extensions/ERC20Capped.sol";
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
    address public factory;
    UniswapRouterInterface public routerAddress;  
    //bool public routerAddressIsV3;  
    uint24 public routerAddressV3Fee;    

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
                address payable _routerAddress,
                //bool _routerAddressIsV3,
                uint24 _routerAddressV3Fee)
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
        //routerAddressIsV3 = _routerAddressIsV3;
        routerAddressV3Fee = _routerAddressV3Fee;
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
        //if (routerAddressIsV3) {
        if (routerAddressV3Fee > 0) {
            address payable _weth9Address = payable(UniswapRouterInterface(routerAddress).WETH9());
            UniswapWETH9Interface(_weth9Address).deposit{ value : amountETH }();
            _approve(_weth9Address, address(routerAddress), amountETH); 
            UniswapPositionManagerInterface.MintParams memory params = UniswapPositionManagerInterface.MintParams({
                token0: address(this),
                token1: _weth9Address,
                fee: routerAddressV3Fee,
                tickLower: MIN_TICK,
                tickUpper: MAX_TICK,
                amount0Desired: amountToken,
                amount1Desired: amountETH,
                amount0Min: 0,
                amount1Min: 0,
                recipient: to,
                deadline: block.timestamp + 30
            }); 
            uint256 tokenId;
            uint128 liquidity;
            uint256 amount0;
            uint256 amount1;            
            (tokenId, liquidity, amount0, amount1) = UniswapPositionManagerInterface(address(routerAddress)).mint(params); 

            if (amount1 < amountETH) {
                //_approve(_weth9Address, address(routerAddress), 0);
                uint256 refund1 = amountETH - amount1;
                //transferFrom(_weth9Address, to, refund1);
                //IUniswapV3Router
                UniswapRouterInterface.ExactInputSingleParams memory swparams;
                swparams.tokenIn = _weth9Address;
                swparams.tokenOut = address(this);
                swparams.fee = routerAddressV3Fee;
                swparams.recipient = to;
                //swparams.deadline = block.timestamp + 30;
                swparams.amountIn = refund1;
                swparams.amountOutMinimum = 0;
                swparams.sqrtPriceLimitX96 = 0; //MAX_PRICE_LIMIT;
                UniswapRouterInterface(address(routerAddress)).exactInputSingle(swparams);
            }   

            if (amount0 < amountToken) {
                _approve(address(this), address(routerAddress), 0);
                uint256 refund0 = amountToken - amount0;
                transferFrom(address(this), to, refund0);
            }
           
        }
        else {          
            uint liquidity;
            uint amount0;
            uint amount1;              
            (amount0, amount1, liquidity) = routerAddress.addLiquidityETH{ value : amountETH }(address(this), amountToken, 0, 0, to, block.timestamp + 30);
            
            if (amount1 < amountETH) {
                uint256 refund1 = amountETH - amount1;
                //payable(to).transfer(refund1);
                address[] memory path;
                path = new address[](1);
                path[0] = address(this);             
                UniswapRouterInterface(address(routerAddress)).swapExactETHForTokens{ value : refund1 }(0, path, to, block.timestamp + 30);
            }    

            if (amount0 < amountToken) {
                _approve(address(this), address(routerAddress), 0);
                uint256 refund0 = amountToken - amount0;
                transferFrom(address(this), to, refund0);
            }        
        }
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

    function withdrawTokens(address token, uint256 amount) external {
        VolcanoERC20Factory vfactory = VolcanoERC20Factory(payable(factory));
        address payable feeRecipient = vfactory.feeRecipient();
        //require(msg.sender == feeRecipient, "Forbidden");        
        transferFrom(token, feeRecipient, amount);
    }      
}
