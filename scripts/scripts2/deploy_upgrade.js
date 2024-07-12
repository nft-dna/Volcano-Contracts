// to deploy locally
// run: npx hardhat node on a terminal
// then run: npx hardhat run --network localhost scripts/scripts2/deploy_upgrade.js

async function main(network) {

    console.log('network: ', network.name);

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log(`Deployer's address: `, deployerAddress);
    const balance  = await ethers.provider.getBalance(deployer);//deployer.getBalance();
    console.log(`Deployer's balance: `, balance);
	
	// Marketplace Proxy deployed at  0xbE7380A00ee08eF2df78548236b01eeCEECD60A9
	const oldAddress = '0xbE7380A00ee08eF2df78548236b01eeCEECD60A9';	
	const VolcanoMarketplaceOld = artifacts.require('VolcanoMarketplace');
	const VolcanoMarketplaceUpgraded = artifacts.require('VolcanoMarketplaceV1');
  
	const volcanoMarketplaceOld = await VolcanoMarketplaceOld.at(oldAddress);
	const oldRegistryAddress = await volcanoMarketplaceOld.addressRegistry();
	console.log('old address = ', oldAddress, ' - registry: ', oldRegistryAddress);
	
	const VolcanoMarketplaceUpgradedFactory = await ethers.getContractFactory('VolcanoMarketplaceV1');
	volcanoMarketplaceUpgraded = await upgrades.upgradeProxy(oldAddress, VolcanoMarketplaceUpgradedFactory, { kind: 'uups' });
	console.log('upgrades.upgradeProxy called');
	await volcanoMarketplaceUpgraded.waitForDeployment();
	console.log('volcanoMarketplaceUpgraded deployed');
	const newAddress = await volcanoMarketplaceUpgraded.getAddress(); 
	console.log('new address = ', newAddress);
	const newRegistryAddress = await this.volcanoMarketplaceUpgraded.addressRegistry();
	console.log('new address = ', newAddress, ' - registry: ', newRegistryAddress);
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
  

