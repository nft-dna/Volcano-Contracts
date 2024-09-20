// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^4.9.6
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./VolcanoERC20Token.sol";
import "./UniswapInterface.sol";

contract VolcanoERC20Factory is Ownable {

    event TokenCreated(address caller, address token);
    event TokenDisabled(address caller, address token);

    mapping(address => bool) public exists;

    uint96 public erc20MintFeePerc;
    uint96 public erc20MintTokenFeePerc;
    uint256 public platformContractFee; // 0.001 1000000000000000
    address payable public feeRecipient;
    address payable public routerAddress;  // Sepolia 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008

    constructor(uint96 _erc20MintFeePerc,
                uint96 _erc20MintTokenFeePerc,
                address payable _feeRecipient,				
                uint256 _platformContractFee,
                address payable _routerAddress)
        //Ownable(msg.sender)
    {
        erc20MintFeePerc = _erc20MintFeePerc;
        erc20MintTokenFeePerc = _erc20MintTokenFeePerc;
        platformContractFee = _platformContractFee;
        feeRecipient = _feeRecipient;       
        routerAddress = _routerAddress;
    }

    function updatePlatformContractFee(uint256 _platformContractFee) external onlyOwner {
        platformContractFee = _platformContractFee;
    }

    function updateErc20MintFeePerc(uint96 _erc20MintFeePerc) external onlyOwner {
        erc20MintFeePerc = _erc20MintFeePerc;
    }

    function updateErc20MintTokenFeePerc(uint96 _erc20MintTokenFeePerc) external onlyOwner {
        erc20MintTokenFeePerc = _erc20MintTokenFeePerc;
    }        

    function updateFeeRecipient(address payable _feeRecipient) external  onlyOwner {
        feeRecipient = _feeRecipient;
    }    

    function updateRouterAddress(address payable _routerAddress) external onlyOwner {
        routerAddress = _routerAddress;
    }    

    function createTokenContract(
                string memory _name, 
                string memory _symbol, 
                string memory _uri,                 
                address _initialReceiver, 
                uint256 _initialAmount, 
                uint256 _capAmount, 
                uint256 _mintBlocks, 
                uint256 _mintBlocksFee)
        external
        payable
        returns (address)
    {
        require(msg.value == platformContractFee, "Insufficient funds.");
        if (platformContractFee > 0) {
            (bool success,) = feeRecipient.call{value: msg.value}("");
            require(success, "Transfer failed");
        }

        VolcanoERC20Token erc20 = new VolcanoERC20Token(
                _name, 
                _symbol, 
                _uri, 
                _initialReceiver, 
                _initialAmount, 
                _capAmount, 
                _mintBlocks, 
                _mintBlocksFee,
                address(this),
                routerAddress
        );
        address factory = UniswapRouterInterface(routerAddress).factory();
        UniswapFactoryInterface(factory).createPair(address(erc20), UniswapRouterInterface(routerAddress).WETH());

        exists[address(erc20)] = true;
        erc20.transferOwnership(_msgSender());
        emit TokenCreated(_msgSender(), address(erc20));
        return address(erc20);
    }    
    
    function mintTokenBlock(address tokenContractAddress, address to) public payable {
        require(exists[tokenContractAddress], "Token contract is not registered");
        VolcanoERC20Token(payable(tokenContractAddress)).mintBlock{ value : msg.value }(to);
    }

    function registerTokenContract(address tokenContractAddress) external onlyOwner {
        require(!exists[tokenContractAddress], "Token contract already registered");
        //require(IERC165(tokenContractAddress).supportsInterface(INTERFACE_ID_ERC20), "Not an ERC20 contract");
        exists[tokenContractAddress] = true;
        emit TokenCreated(_msgSender(), tokenContractAddress);
    }

    function disableTokenContract(address tokenContractAddress) external onlyOwner {
        require(exists[tokenContractAddress], "Token contract is not registered");
        exists[tokenContractAddress] = false;
        emit TokenDisabled(_msgSender(), tokenContractAddress);
    }    
}
