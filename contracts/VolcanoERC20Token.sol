// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^4.9.6
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
//import "./VolcanoERC20Staking.sol";
import "./VolcanoERC20FactoryInterface.sol";
import "./UniswapInterface.sol";

contract VolcanoERC20Token is ERC20, ERC20Burnable, Ownable, ERC20Permit, ERC20Capped {
    uint256 public initialReserves;
    uint256 public stakingAmount;
    uint256 public mintBlocksAmount;
    uint256 public mintBlocksFee;
    uint256 public mintBlocksSupply;
    uint256 public mintBlocksMaxSupply;
    // Opensea json metadata format interface
    string private _contractURI;      
    VolcanoERC20FactoryInterface public factory;
    UniswapRouterInterface public routerAddress;  
    //bool public routerAddressIsV3;  
    uint24 public routerAddressV3Fee;   
    mapping(address => uint256) public v3positions; 
    VolcanoERC20StakingInterface public stakingAddress;

    event BlocksMinted(address receiver, uint256 count);

    constructor(string memory _name, 
                string memory _symbol, 
                //string memory _uri,                 
                address _initialReceiver, 
                uint256 _initialAmount, 
                uint256 _capAmount, 
                uint256 _mintBlocks, 
                uint256 _mintBlocksFee,
                address _factory,
                address payable _routerAddress,
                //bool _routerAddressIsV3,
                uint24 _routerAddressV3Fee,
                uint256 _stakingAmount)
        ERC20(_name, _symbol)
        //Ownable(msg.sender)
        ERC20Permit(_name)
        ERC20Capped(_capAmount)
    {        
        require(_capAmount >= _initialAmount + _stakingAmount, "Cap");
        require(_mintBlocks > 0, "0blocks");
        //_contractURI = _uri;
        factory = VolcanoERC20FactoryInterface(_factory);
        initialReserves = _initialAmount;
        mintBlocksAmount = (_capAmount - _initialAmount - _stakingAmount) / (2*_mintBlocks);
        mintBlocksFee = _mintBlocksFee;
        routerAddress = UniswapRouterInterface(_routerAddress);
        //routerAddressIsV3 = _routerAddressIsV3;
        routerAddressV3Fee = _routerAddressV3Fee;
        _mint(_initialReceiver, _initialAmount);
        mintBlocksSupply = 0;
        mintBlocksMaxSupply = _mintBlocks;
        stakingAddress = VolcanoERC20StakingInterface(address(0));//_stakingAddress;
        stakingAmount = _stakingAmount;
    }

    function initilizeStaking(VolcanoERC20StakingInterface _stakingAddress) public  {
        //require(msg.sender == address(factory), "not allowed");
        //require(stakingAmount > 0, "wrong staking amount");
        if ((stakingAmount > 0) && (msg.sender == address(factory))) {
            stakingAddress = _stakingAddress;
            //VolcanoERC20Staking stkAddress = new VolcanoERC20Staking((address(this)), factory.feeRecipient());
            //stakingAddress = payable(address(stkAddress));
            _mint(address(stakingAddress), stakingAmount);
            stakingAddress.fundRewards(address(this), stakingAmount);
        }    
    }

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }
    /*function transferOwnership(address newOwner) public override onlyOwner
    {
        require(newOwner != address(0), "Zero address not allowed");
        if (stakingAddress != address(0))
            Ownable(stakingAddress).transferOwnership(newOwner);
        super.transferOwnership(newOwner);
    }*/    

    // needed in 4.9.6
    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Capped) {
        ERC20Capped._mint(to, amount);
    }
    
    function getTickSpacing(uint24 feeTier) internal pure returns (int24) {
        if (feeTier == 100) return 1;      // 0.01% fee tier
        if (feeTier == 500) return 10;     // 0.05% fee tier
        if (feeTier == 3000) return 60;    // 0.3% fee tier
        if (feeTier == 10000) return 200;  // 1% fee tier
        revert("Invalid fee tier");
    }

    function getMinUsableTick(uint24 feeTier) internal pure returns (int24) {
        int24 tickSpacing = getTickSpacing(feeTier);
        
        // Round MIN_TICK up to the nearest multiple of tickSpacing
        int24 minUsable = (MIN_TICK / tickSpacing) * tickSpacing;
        if (MIN_TICK % tickSpacing != 0) {
            minUsable += tickSpacing; // Ensure it's a valid tick
        }

        return minUsable;
    }

    function getMaxUsableTick(uint24 feeTier) internal pure returns (int24) {
        int24 tickSpacing = getTickSpacing(feeTier);

        // Round MAX_TICK down to the nearest multiple of tickSpacing
        int24 maxUsable = (MAX_TICK / tickSpacing) * tickSpacing;

        return maxUsable;
    }      

    function mintBlocks(address to, uint256 count, bool refund) public payable {
        require(totalSupply() + (2*mintBlocksAmount*count) <= cap(), "Cap");        
        require(msg.value == mintBlocksFee*count, "Fee");
        
        //VolcanoERC20Factory vfactory = VolcanoERC20Factory(payable(factory));
        address payable feeRecipient = factory.feeRecipient();
        uint256 tokenFeeAmount = (mintBlocksAmount*count * factory.erc20MintTokenFeePerc()) / 10000;

        _mint(to, mintBlocksAmount*count);

        if (tokenFeeAmount > 0) {
            _mint(feeRecipient, tokenFeeAmount);
        }
        _mint(address(this), mintBlocksAmount*count - tokenFeeAmount);
        uint256 feeAmount = (mintBlocksFee*count * factory.erc20MintFeePerc()) / 10000;
        _addLiquidityETH(mintBlocksAmount*count - tokenFeeAmount, mintBlocksFee*count - feeAmount, to, refund);

        if (feeAmount > 0) {
            (bool success,) = feeRecipient.call{ value : feeAmount }("");
            require(success, "Tx failed");                 
        }

        mintBlocksSupply = mintBlocksSupply + count;
        emit BlocksMinted(to, count);
     }

    function _addLiquidityETH(
        uint amountToken,
        uint amountETH,
        address to, bool refund) internal {           
        //if (routerAddressIsV3) {
        if (routerAddressV3Fee > 0) {
            uint256 tokenId = v3positions[to];
            uint128 liquidity;
            uint256 amount0;
            uint256 amount1;  
            address payable _weth9Address = payable(UniswapRouterInterface(routerAddress).WETH9());
            UniswapWETH9Interface(_weth9Address).deposit{ value : amountETH }(); 
            address positionManager = UniswapRouterInterface(routerAddress).positionManager();
            ERC20(address(this)).approve(positionManager, amountToken);  
            ERC20(_weth9Address).approve(positionManager, amountETH);                                               
            if (tokenId == 0) {
                UniswapPositionManagerInterface.MintParams memory params = UniswapPositionManagerInterface.MintParams({
                    token0: address(this),
                    token1: _weth9Address,
                    fee: routerAddressV3Fee,
                    tickLower: getMinUsableTick(routerAddressV3Fee),
                    tickUpper: getMaxUsableTick(routerAddressV3Fee),
                    amount0Desired: amountToken,
                    amount1Desired: amountETH,
                    amount0Min: 1,
                    amount1Min: 1,
                    recipient: address(this),
                    deadline: block.timestamp + 30
                });      
                (tokenId, liquidity, amount0, amount1) = UniswapPositionManagerInterface(positionManager).mint(params); 
                v3positions[to] = tokenId;
            } else {
                bool swappos = (_weth9Address<address(this));
                UniswapPositionManagerInterface.IncreaseLiquidityParams memory params = UniswapPositionManagerInterface.IncreaseLiquidityParams({
                    tokenId: tokenId,
                    amount0Desired: swappos ? amountETH : amountToken,
                    amount1Desired: swappos ? amountToken : amountETH,
                    amount0Min: 1,
                    amount1Min: 1,
                    deadline: block.timestamp + 30
                });      
                uint256 am0;
                uint256 am1;
                (liquidity, am0, am1) = UniswapPositionManagerInterface(positionManager).increaseLiquidity(params);                 
                amount0 = swappos ? am1 : am0;
                amount1 = swappos ? am0 : am1;
            }
            if (refund) {            
                if (amount1 < amountETH) {
                    uint256 refund1 = amountETH - amount1;     
                    //IUniswapV3Router
                    UniswapRouterInterface.ExactInputSingleParams memory swparams;
                    swparams.tokenIn = _weth9Address;
                    swparams.tokenOut = address(this);
                    swparams.fee = routerAddressV3Fee;
                    swparams.recipient = to;
                    //swparams.deadline = block.timestamp + 30;
                    swparams.amountIn = refund1;
                    swparams.amountOutMinimum = 1;
                    swparams.sqrtPriceLimitX96 = 0; //MAX_PRICE_LIMIT;     
                    ERC20(_weth9Address).approve(address(routerAddress), refund1);                      
                    try UniswapRouterInterface(address(routerAddress)).exactInputSingle(swparams) {                   
                    } catch {
                        ERC20(_weth9Address).approve(positionManager, 0);
                        //ERC20(_weth9Address).transfer(to, refund1);
                        UniswapWETH9Interface(_weth9Address).withdraw(refund1);
                        payable(to).transfer(refund1);
                    }
                }   

                if (amount0 < amountToken) {
                    ERC20(address(this)).approve(positionManager, 0);
                    uint256 refund0 = amountToken - amount0;
                    ERC20(address(this)).transfer(to, refund0);
                }
            }
           
        }
        else {          
            uint liquidity;
            uint amount0;
            uint amount1;   
            _approve(address(this), address(routerAddress), amountToken);  

            (amount0, amount1, liquidity) = routerAddress.addLiquidityETH{ value : amountETH }(address(this), amountToken, 0, 0, to, block.timestamp + 30);
            
            if (refund) { 
                if (amount1 < amountETH) {
                    uint256 refund1 = amountETH - amount1;
                    address[] memory path;
                    path = new address[](1);
                    path[0] = address(this);                   
                    try UniswapRouterInterface(address(routerAddress)).swapExactETHForTokens{ value : refund1 }(0, path, to, block.timestamp + 30) {                
                    } catch {
                        payable(to).transfer(refund1);
                    }                
                }    

                if (amount0 < amountToken) {
                    ERC20(address(this)).approve(address(routerAddress), 0);
                    uint256 refund0 = amountToken - amount0;
                    ERC20(address(this)).transfer(to, refund0);
                }   
            }     
        }
    }        

    function updateContractURI(string memory _uri) public onlyOwner {
        _contractURI = _uri;
    }   

    function collectV3Position(uint256 tokenid) public {
        require(v3positions[msg.sender] == tokenid, "Owner");
        UniswapPositionManagerInterface.CollectParams memory params = UniswapPositionManagerInterface.CollectParams({
            tokenId: tokenid,
            recipient: msg.sender,
            amount0Max: type(uint128).max,
            amount1Max: type(uint128).max
            });
        address positionManager = UniswapRouterInterface(routerAddress).positionManager();
        UniswapPositionManagerInterface(positionManager).approve(msg.sender, tokenid);
        UniswapPositionManagerInterface(positionManager).collect(params);
        UniswapPositionManagerInterface(positionManager).approve(address(0), tokenid);
    }  

    function burnV3Position(address positionOwner) public {
        //VolcanoERC20Factory vfactory = VolcanoERC20Factory(payable(factory));
        address payable feeRecipient = factory.feeRecipient();//VolcanoERC20Factory(payable(factory)).feeRecipient();        
        require(msg.sender == feeRecipient, "not allowed");
        uint256 tokenid = v3positions[positionOwner];
        require(tokenid != 0, "no position"); 
        uint128 liquidity;
        address token0;
        address token1;
        uint256 amount0;
        uint256 amount1;        
        address positionManager = UniswapRouterInterface(routerAddress).positionManager();   
        (
            ,
            ,
            token0,
            token1,
            ,
            ,
            ,
            liquidity,
            ,
            ,
            ,

        ) = UniswapPositionManagerInterface(positionManager).positions(tokenid);    

        UniswapPositionManagerInterface(positionManager).approve(msg.sender, tokenid);
        
        UniswapPositionManagerInterface.DecreaseLiquidityParams memory dparams = UniswapPositionManagerInterface.DecreaseLiquidityParams({
                tokenId: tokenid,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            });
        UniswapPositionManagerInterface(positionManager).decreaseLiquidity(dparams);

        UniswapPositionManagerInterface.CollectParams memory cparams = UniswapPositionManagerInterface.CollectParams({
                tokenId: tokenid,
                recipient: feeRecipient,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });
        (amount0, amount1) = UniswapPositionManagerInterface(positionManager).collect(cparams);
        v3positions[positionOwner] = 0;
        //ERC20(token0).transfer(feeRecipient, amount0);
        //ERC20(token1).transfer(feeRecipient, amount1);
        UniswapPositionManagerInterface(positionManager).burn(tokenid);
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
        //VolcanoERC20Factory vfactory = VolcanoERC20Factory(payable(factory));
        address payable feeRecipient = factory.feeRecipient();
        //require(msg.sender == feeRecipient, "Forbidden");        
        feeRecipient.transfer(amount);
    }    

    function withdrawTokens(address token, uint256 amount) external {
        //VolcanoERC20Factory vfactory = VolcanoERC20Factory(payable(factory));
        address payable feeRecipient = factory.feeRecipient();
        //require(msg.sender == feeRecipient, "Forbidden");        
        transferFrom(token, feeRecipient, amount);
    }      
}
