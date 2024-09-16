// to deploy locally
// run: npx hardhat node on a terminal
// then run: npx hardhat run --network localhost scripts/scripts2/deploy_factory.js

async function main(network) {

    console.log('network: ', network.name);
	
	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log(`Deployer's address: `, deployerAddress);
    const balance  = await ethers.provider.getBalance(deployer);//deployer.getBalance();
    console.log(`Deployer's balance: `, balance);
  
    const { TREASURY_ADDRESS, PLATFORM_FEE, WRAPPED_WETH_MAINNET, WRAPPED_WETH_TESTNET, PLATFORM_FACTORY_FEE, PLATFORM_MINT_FEE } = require('../constants');
  
	const AUCTION_PROXY_ADDRESS = '0x57EBE4C797572AF95C70B04a941AE9E71c467bb6';
	const MARKETPLACE_PROXY_ADDRESS = '0x99621a66edf5B9e16B510Ff8A2A56094D698c275';	
	const BUNDLE_MARKETPLACE_PROXY_ADDRESS = '0x3097489d44C5A6A1B087f946Cf81B42F641774eD';	
	
	const oldAddressRegistry = '0x762e9C42ff93f8850ce8E4e001c16d3d75e678E8';	
	const VolcanoAddressRegistry = artifacts.require('VolcanoAddressRegistry');
	const addressRegistry = await VolcanoAddressRegistry.at(oldAddressRegistry);

    ///////
    const volcanoERC721Factory = await ethers.getContractFactory('VolcanoERC721Factory');
    const erc721Factory = await volcanoERC721Factory.deploy(AUCTION_PROXY_ADDRESS, MARKETPLACE_PROXY_ADDRESS, BUNDLE_MARKETPLACE_PROXY_ADDRESS, TREASURY_ADDRESS, PLATFORM_FACTORY_FEE, PLATFORM_MINT_FEE);
    await erc721Factory.waitForDeployment();        
	const FACTORY_ERC721_ADDRESS = await erc721Factory.getAddress(); 
    console.log('VolcanoERC721Factory deployed to:', await erc721Factory.getAddress());
    ///////
   
    ///////
	/* only for debug ...
    const contractERC721Options = {
       usebaseuri: true,
       baseUri: "",
       baseUriExt: "",
       maxItems: '1000',
       mintStartTime: '0',
       mintStopTime: '0',
    }		
    const volcanoERC721Tradable = await ethers.getContractFactory('VolcanoERC721Tradable');   
    const erc721Tradable = await volcanoERC721Tradable.deploy('VolcanoERC721', 'MVLC', AUCTION_PROXY_ADDRESS, MARKETPLACE_PROXY_ADDRESS, BUNDLE_MARKETPLACE_PROXY_ADDRESS, FACTORY_ERC721_ADDRESS, '50000000000000000', '50000000000000000', TREASURY_ADDRESS, false, contractERC721Options);
    await erc721Tradable.waitForDeployment();    
    console.log('VolcanoERC721Tradable deployed to:', await erc721Tradable.getAddress());
	*/
    ////////
    
    ////////
    const volcanoERC1155Factory = await ethers.getContractFactory('VolcanoERC1155Factory');
    const erc1155Factory = await volcanoERC1155Factory.deploy(AUCTION_PROXY_ADDRESS, MARKETPLACE_PROXY_ADDRESS, BUNDLE_MARKETPLACE_PROXY_ADDRESS, TREASURY_ADDRESS, PLATFORM_FACTORY_FEE, PLATFORM_MINT_FEE);
    await erc1155Factory.waitForDeployment();
	const FACTORY_ERC1155_ADDRESS = await erc1155Factory.getAddress(); 
    console.log('VolcanoERC1155Factory deployed to:', await erc1155Factory.getAddress());
    ////////
    
    ////////
	/* only for debug ...
    const contractERC1155Options = {
        baseUri: "",
		maxItems: '1000',	
		maxItemSupply: '100',
		mintStartTime: '0',
		mintStopTime: '0',
    }		
    const volcanoERC1155Tradable = await ethers.getContractFactory('VolcanoERC1155Tradable');
    const erc1155Tradable = await volcanoERC1155Tradable.deploy('VolcanoERC1155', 'MVLC', AUCTION_PROXY_ADDRESS, MARKETPLACE_PROXY_ADDRESS, BUNDLE_MARKETPLACE_PROXY_ADDRESS, FACTORY_ERC1155_ADDRESS, '50000000000000000', '50000000000000000', TREASURY_ADDRESS, false, contractERC1155Options);
    await erc1155Tradable.waitForDeployment();
    console.log('VolcanoERC1155Tradable deployed to:', await erc1155Tradable.getAddress());
	*/
    ///////
    
    await addressRegistry.updateErc721Factory(FACTORY_ERC721_ADDRESS);
    await addressRegistry.updateErc1155Factory(FACTORY_ERC1155_ADDRESS);   

    
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
  

