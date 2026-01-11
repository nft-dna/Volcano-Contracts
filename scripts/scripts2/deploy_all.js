// to deploy locally
// run: npx hardhat node on a terminal
// then run: npx hardhat run --network localhost scripts/scripts2/deploy_all.js

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
  

    /////////
    const Marketplace = await ethers.getContractFactory('VolcanoMarketplace');
    const marketplaceProxy = await upgrades.deployProxy(Marketplace, [TREASURY_ADDRESS, PLATFORM_FEE], { initializer: 'initialize', kind: 'uups' });
	//const marketplaceProxy = await Marketplace.deploy(TREASURY_ADDRESS, PLATFORM_FEE);
    await marketplaceProxy.waitForDeployment();
    console.log('Marketplace Proxy deployed at ', await marketplaceProxy.getAddress());
    const MARKETPLACE_PROXY_ADDRESS = await marketplaceProxy.getAddress();
	await logDeployment("VolcanoMarketplace", marketplaceProxy, ethers.provider);
    /////////

    /////////
    const BundleMarketplace = await ethers.getContractFactory('VolcanoBundleMarketplace');
    const bundleMarketplaceProxy = await upgrades.deployProxy(BundleMarketplace, [TREASURY_ADDRESS, PLATFORM_FEE], { initializer: 'initialize', kind: 'uups' });
	//const bundleMarketplaceProxy = await BundleMarketplace.deploy(TREASURY_ADDRESS, PLATFORM_FEE);
    await bundleMarketplaceProxy.waitForDeployment();
    console.log('Bundle Marketplace Proxy deployed at ', await bundleMarketplaceProxy.getAddress());  
    const BUNDLE_MARKETPLACE_PROXY_ADDRESS = await bundleMarketplaceProxy.getAddress();
	await logDeployment("VolcanoBundleMarketplace", bundleMarketplaceProxy, ethers.provider);
    ////////

    ////////
    const Auction = await ethers.getContractFactory('VolcanoAuction');
    const auctionProxy = await upgrades.deployProxy(Auction, [TREASURY_ADDRESS, PLATFORM_FEE], { initializer: 'initialize', kind: 'uups' });
	//const auctionProxy = await Auction.deploy(TREASURY_ADDRESS, PLATFORM_FEE);
    await auctionProxy.waitForDeployment(); 
    console.log('Auction Proxy deployed at ', await auctionProxy.getAddress());
    const AUCTION_PROXY_ADDRESS = await auctionProxy.getAddress(); 
	await logDeployment("VolcanoAuction", auctionProxy, ethers.provider);
    ////////
       

    ///////
    const volcanoERC721Factory = await ethers.getContractFactory('VolcanoERC721Factory');
    const erc721Factory = await volcanoERC721Factory.deploy(AUCTION_PROXY_ADDRESS, MARKETPLACE_PROXY_ADDRESS, BUNDLE_MARKETPLACE_PROXY_ADDRESS, TREASURY_ADDRESS, PLATFORM_FACTORY_FEE, PLATFORM_MINT_FEE);
    await erc721Factory.waitForDeployment();        
	const FACTORY_ERC721_ADDRESS = await erc721Factory.getAddress(); 
    console.log('VolcanoERC721Factory deployed to:', await erc721Factory.getAddress());
	await logDeployment("VolcanoERC721Factory", erc721Factory, ethers.provider);
    ///////  
    
    ////////
    const volcanoERC1155Factory = await ethers.getContractFactory('VolcanoERC1155Factory');
    const erc1155Factory = await volcanoERC1155Factory.deploy(AUCTION_PROXY_ADDRESS, MARKETPLACE_PROXY_ADDRESS, BUNDLE_MARKETPLACE_PROXY_ADDRESS, TREASURY_ADDRESS, PLATFORM_FACTORY_FEE, PLATFORM_MINT_FEE);
    await erc1155Factory.waitForDeployment();
	const FACTORY_ERC1155_ADDRESS = await erc1155Factory.getAddress(); 
    console.log('VolcanoERC1155Factory deployed to:', await erc1155Factory.getAddress());
	await logDeployment("VolcanoERC1155Factory", erc1155Factory, ethers.provider);
    ////////    
	
	
    ////////
    const volcanoERC20Staking = await ethers.getContractFactory('VolcanoERC20Staking');
    const erc20Staking = await volcanoERC20Staking.deploy(TREASURY_ADDRESS);
    await erc20Staking.waitForDeployment();
	const STAKING_ERC20_ADDRESS = await erc20Staking.getAddress(); 
    console.log('VolcanoERC20Staking deployed to:', await erc20Staking.getAddress());
	await logDeployment("VolcanoERC20Staking", erc20Staking, ethers.provider);
    ////////		
    ////////
    const volcanoERC20Factory = await ethers.getContractFactory('VolcanoERC20Factory');
    const erc20Factory = await volcanoERC20Factory.deploy(0/*PLATFORM_ERC20FACTORY_NATIVE_PERC*/, 0/*PLATFORM_ERC20FACTORY_TOKEN_PERC*/, TREASURY_ADDRESS, PLATFORM_FACTORY_FEE, ERC20_ROUTER_ADDRESS, ERC20_ROUTER_POOL_FEE, STAKING_ERC20_ADDRESS);
    await erc20Factory.waitForDeployment();
	const FACTORY_ERC20_ADDRESS = await erc20Factory.getAddress(); 
    console.log('VolcanoERC20Factory deployed to:', await erc20Factory.getAddress());
	await logDeployment("VolcanoERC20Factory", erc20Factory, ethers.provider);
    ////////	
    
    ////////
    const TokenRegistry = await ethers.getContractFactory('VolcanoTokenRegistry');
    const tokenRegistry = await TokenRegistry.deploy();
    await tokenRegistry.waitForDeployment(); 
    console.log('VolcanoTokenRegistry deployed to', await tokenRegistry.getAddress());
	await logDeployment("VolcanoTokenRegistry", tokenRegistry, ethers.provider);
    ////////

    ////////
    const AddressRegistry = await ethers.getContractFactory('VolcanoAddressRegistry');
    const addressRegistry = await AddressRegistry.deploy();
    await addressRegistry.waitForDeployment();  
    console.log('VolcanoAddressRegistry deployed to', await addressRegistry.getAddress());
    const ADDRESS_REGISTRY = await addressRegistry.getAddress();
	await logDeployment("VolcanoAddressRegistry", addressRegistry, ethers.provider);
    ////////

    ////////
    const PriceFeed = await ethers.getContractFactory('VolcanoPriceFeed');
    const WRAPPED_WETH = network.name === 'mainnet' ? WRAPPED_WETH_MAINNET : WRAPPED_WETH_TESTNET;
    const priceFeed = await PriceFeed.deploy( ADDRESS_REGISTRY, WRAPPED_WETH);
    await priceFeed.waitForDeployment();  
    console.log('VolcanoPriceFeed deployed to', await priceFeed.getAddress());
	await logDeployment("VolcanoPriceFeed", priceFeed, ethers.provider);
    ////////
    
    await marketplaceProxy.updateAddressRegistry(ADDRESS_REGISTRY);   
    await bundleMarketplaceProxy.updateAddressRegistry(ADDRESS_REGISTRY); 
    await auctionProxy.updateAddressRegistry(ADDRESS_REGISTRY);    
    
    //await addressRegistry.updateVolcanoCom(artion.address);
    await addressRegistry.updateAuction(AUCTION_PROXY_ADDRESS);
    await addressRegistry.updateMarketplace(MARKETPLACE_PROXY_ADDRESS);
    await addressRegistry.updateBundleMarketplace(BUNDLE_MARKETPLACE_PROXY_ADDRESS);
    await addressRegistry.updateErc721Factory(FACTORY_ERC721_ADDRESS);
    await addressRegistry.updateErc1155Factory(FACTORY_ERC1155_ADDRESS);  
	await addressRegistry.updateErc20Factory(FACTORY_ERC20_ADDRESS);  
    await addressRegistry.updateTokenRegistry(await tokenRegistry.getAddress());
    await addressRegistry.updatePriceFeed(await priceFeed.getAddress());
 

	// allow 'WRAPPED_WETH' usage
	await tokenRegistry.add(WRAPPED_WETH);
	// allow 'native token' usage
    await tokenRegistry.add(ZERO_ADDRESS);	
    
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
  

