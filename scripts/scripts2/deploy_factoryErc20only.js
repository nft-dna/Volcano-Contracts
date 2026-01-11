// to deploy locally
// run: npx hardhat node on a terminal
// then run: npx hardhat run --network localhost scripts/scripts2/deploy_factory.js

const  { logDeployment } = require("./logDeployment.js");

async function main(network) {

    console.log('network: ', network.name);
	
	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log(`Deployer's address: `, deployerAddress);
    const balance  = await ethers.provider.getBalance(deployer);//deployer.getBalance();
    console.log(`Deployer's balance: `, balance);
  
    const { TREASURY_ADDRESS, PLATFORM_FEE, WRAPPED_WETH_MAINNET, WRAPPED_WETH_TESTNET, PLATFORM_FACTORY_FEE, PLATFORM_MINT_FEE, ERC20_ROUTER_ADDRESS, ERC20_ROUTER_POOL_FEE } = require('../constants');
  
	const oldAddressRegistry = '0x08702E7ebB8a07E8560D3D80Ad51d653a0E2805C';	
	const VolcanoAddressRegistry = artifacts.require('VolcanoAddressRegistry');
	const addressRegistry = await VolcanoAddressRegistry.at(oldAddressRegistry);
	/**/
    ////////	

    ////////
    //const volcanoERC20Staking = await ethers.getContractFactory('VolcanoERC20Staking');
    //const erc20Staking = await volcanoERC20Staking.deploy(TREASURY_ADDRESS);
    //await erc20Staking.waitForDeployment();
	//const STAKING_ERC20_ADDRESS = await erc20Staking.getAddress(); 
    //console.log('VolcanoERC20Staking deployed to:', await erc20Staking.getAddress());
	//await logDeployment("VolcanoERC20Staking", erc20Staking, ethers.provider);
	const STAKING_ERC20_ADDRESS = '0x96F8fA9c76658604C9405e99174792c5400e5bAd';	
    ////////			
    ////////
    const volcanoERC20Factory = await ethers.getContractFactory('VolcanoERC20Factory');
    const erc20Factory = await volcanoERC20Factory.deploy(0/*PLATFORM_ERC20FACTORY_NATIVE_PERC*/, 0/*PLATFORM_ERC20FACTORY_TOKEN_PERC*/, TREASURY_ADDRESS, PLATFORM_FACTORY_FEE, ERC20_ROUTER_ADDRESS, ERC20_ROUTER_POOL_FEE, STAKING_ERC20_ADDRESS);
    await erc20Factory.waitForDeployment();
	const FACTORY_ERC20_ADDRESS = await erc20Factory.getAddress(); 
    console.log('VolcanoERC20Factory deployed to:', await erc20Factory.getAddress());
	await logDeployment("VolcanoERC20Factory", erc20Factory, ethers.provider);
    ////////


    await addressRegistry.updateErc20Factory(FACTORY_ERC20_ADDRESS);   	
    
    const finalbalance = await ethers.provider.getBalance(deployer);//deployer.getBalance();
    console.log(`Deployer's balance: `, finalbalance);

  }
  
  // We recommend this pattern to be able to use async/await everywhere
  // and properly handle errors.
  main(network)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  

