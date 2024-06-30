// to deploy locally
// run: npx hardhat node on a terminal
// then run: npx hardhat run --network localhost scripts/scripts2/deploy_extras.js

async function main(network) {

    console.log('network: ', network.name);

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log(`Deployer's address: `, deployerAddress);
    const balance  = await ethers.provider.getBalance(deployer);//deployer.getBalance();
    console.log(`Deployer's balance: `, balance);
	
	const { RANDOM_NUMBER_PROVIDER_ADDRESS } = require('../constants');
  
    ///////
    const RandomNumberOracle = await ethers.getContractFactory('RandomNumberOracle');
    const randomNumberOracle = await RandomNumberOracle.deploy(RANDOM_NUMBER_PROVIDER_ADDRESS);
    await randomNumberOracle.waitForDeployment();        
    console.log('RandomNumberOracle deployed to:', await randomNumberOracle.getAddress());
    ///////   

    ///////
    const PriceOracleProxy = await ethers.getContractFactory('PriceOracleProxy');   
    const priceOracleProxy = await PriceOracleProxy.deploy();
    await priceOracleProxy.waitForDeployment();    
    console.log('PriceOracleProxy deployed to:', await priceOracleProxy.getAddress());
    ////////    
    
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
  

