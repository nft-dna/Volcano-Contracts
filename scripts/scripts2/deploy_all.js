// to deploy locally
// run: npx hardhat node on a terminal
// then run: npx hardhat run --network localhost scripts/scripts2/deploy_all.js
async function main(network) {

    console.log('network: ', network.name);

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log(`Deployer's address: `, deployerAddress);
    const balance  = await deployer.getBalance();
    console.log(`Deployer's balance: `, balance);
  
    const { TREASURY_ADDRESS, PLATFORM_FEE, WRAPPED_FTM_MAINNET, WRAPPED_FTM_TESTNET } = require('../constants');
  
    ////////////
    const Artion = await ethers.getContractFactory('PricyCom');
    //console.log( ' getContractFactory(PricyCom)');
    const artion = await Artion.deploy(TREASURY_ADDRESS, '2000000000000000000');
    //console.log( ' await Artion.deploy');
  
    await artion.deployed();  
    console.log('PricyCom deployed at', artion.address);
    ///////////

    //////////
    const ProxyAdmin = await ethers.getContractFactory('ProxyAdmin');
    const proxyAdmin = await ProxyAdmin.deploy();
    await proxyAdmin.deployed();

    const PROXY_ADDRESS = proxyAdmin.address;

    console.log('ProxyAdmin deployed to:', proxyAdmin.address);

    const AdminUpgradeabilityProxyFactory = await ethers.getContractFactory('AdminUpgradeabilityProxy');
    //////////

    /////////
    const Marketplace = await ethers.getContractFactory('PricyMarketplace');
    const marketplaceImpl = await Marketplace.deploy();
    await marketplaceImpl.deployed();

    console.log('PricyMarketplace deployed to:', marketplaceImpl.address);
    
    const marketplaceProxy = await AdminUpgradeabilityProxyFactory.deploy(
        marketplaceImpl.address,
        PROXY_ADDRESS,
        []
    );
    await marketplaceProxy.deployed();
    console.log('Marketplace Proxy deployed at ', marketplaceProxy.address);
    const MARKETPLACE_PROXY_ADDRESS = marketplaceProxy.address;
    const marketplace = await ethers.getContractAt('PricyMarketplace', marketplaceProxy.address);
    
    await marketplace.initialize(TREASURY_ADDRESS, PLATFORM_FEE);
    console.log('Marketplace Proxy initialized');
    
    /////////

    /////////
    const BundleMarketplace = await ethers.getContractFactory('PricyBundleMarketplace');
    const bundleMarketplaceImpl = await BundleMarketplace.deploy();
    await bundleMarketplaceImpl.deployed();
    console.log('PricyBundleMarketplace deployed to:', bundleMarketplaceImpl.address);
    
    const bundleMarketplaceProxy = await AdminUpgradeabilityProxyFactory.deploy(
        bundleMarketplaceImpl.address,
        PROXY_ADDRESS,
        []
      );
    await bundleMarketplaceProxy.deployed();
    console.log('Bundle Marketplace Proxy deployed at ', bundleMarketplaceProxy.address);  
    const BUNDLE_MARKETPLACE_PROXY_ADDRESS = bundleMarketplaceProxy.address;
    const bundleMarketplace = await ethers.getContractAt('PricyBundleMarketplace', bundleMarketplaceProxy.address);
    
    await bundleMarketplace.initialize(TREASURY_ADDRESS, PLATFORM_FEE);
    console.log('Bundle Marketplace Proxy initialized');
    
    ////////

    ////////
    const Auction = await ethers.getContractFactory('PricyAuction');
    const auctionImpl = await Auction.deploy();
    await auctionImpl.deployed();
    console.log('PricyAuction deployed to:', auctionImpl.address);

    const auctionProxy = await AdminUpgradeabilityProxyFactory.deploy(
        auctionImpl.address,
        PROXY_ADDRESS,
        []
      );

    await auctionProxy.deployed();
    console.log('Auction Proxy deployed at ', auctionProxy.address);
    const AUCTION_PROXY_ADDRESS = auctionProxy.address;
    const auction = await ethers.getContractAt('PricyAuction', auctionProxy.address);
    
    await auction.initialize(TREASURY_ADDRESS);
    console.log('Auction Proxy initialized');
   
    ////////

    ////////
    const Factory = await ethers.getContractFactory('PricyERC721Factory');
    const factory = await Factory.deploy(
        AUCTION_PROXY_ADDRESS,
        MARKETPLACE_PROXY_ADDRESS,
        BUNDLE_MARKETPLACE_PROXY_ADDRESS,
        '10000000000000000000',
        TREASURY_ADDRESS,
        '50000000000000000000'
    );
    await factory.deployed();
    console.log('PricyERC721Factory deployed to:', factory.address);

    const PrivateFactory = await ethers.getContractFactory('PricyERC721FactoryPrivate');
    const privateFactory = await PrivateFactory.deploy(
        AUCTION_PROXY_ADDRESS,
        MARKETPLACE_PROXY_ADDRESS,
        BUNDLE_MARKETPLACE_PROXY_ADDRESS,
        '10000000000000000000',
        TREASURY_ADDRESS,
        '50000000000000000000'
    );
    await privateFactory.deployed();
    console.log('PricyERC721FactoryPrivate deployed to:', privateFactory.address);
    ////////    

    ////////
    const NFTTradable = await ethers.getContractFactory('PricyERC721Tradable');
    const nft = await NFTTradable.deploy(
        'PricyERC721',
        'PRY',
        AUCTION_PROXY_ADDRESS,
        MARKETPLACE_PROXY_ADDRESS,
        BUNDLE_MARKETPLACE_PROXY_ADDRESS,
        '10000000000000000000',
        TREASURY_ADDRESS
    );
    await nft.deployed();
    console.log('PricyERC721Tradable deployed to:', nft.address);

    const NFTTradablePrivate = await ethers.getContractFactory('PricyERC721TradablePrivate');
    const nftPrivate = await NFTTradablePrivate.deploy(
        'IPricyERC721',
        'IPRY',
        AUCTION_PROXY_ADDRESS,
        MARKETPLACE_PROXY_ADDRESS,
        BUNDLE_MARKETPLACE_PROXY_ADDRESS,
        '10000000000000000000',
        TREASURY_ADDRESS
    );
    await nftPrivate.deployed();
    console.log('PricyERC721TradablePrivate deployed to:', nftPrivate.address);
    ////////

    ////////
    const TokenRegistry = await ethers.getContractFactory('PricyTokenRegistry');
    const tokenRegistry = await TokenRegistry.deploy();

    await tokenRegistry.deployed();

    console.log('PricyTokenRegistry deployed to', tokenRegistry.address);
    ////////

    ////////
    const AddressRegistry = await ethers.getContractFactory('PricyAddressRegistry');
    const addressRegistry = await AddressRegistry.deploy();

    await addressRegistry.deployed();

    console.log('PricyAddressRegistry deployed to', addressRegistry.address);
    const PRICYCOM_ADDRESS_REGISTRY = addressRegistry.address;
    ////////

    ////////
    const PriceFeed = await ethers.getContractFactory('PricyPriceFeed');
    const WRAPPED_FTM = network.name === 'mainnet' ? WRAPPED_FTM_MAINNET : WRAPPED_FTM_TESTNET;
    const priceFeed = await PriceFeed.deploy(
      PRICYCOM_ADDRESS_REGISTRY,
      WRAPPED_FTM
    );
  
    await priceFeed.deployed();
  
    console.log('PricyPriceFeed deployed to', priceFeed.address);
    ////////

    ////////
    const ArtTradable = await ethers.getContractFactory('PricyERC1155Tradable');
    const artTradable = await ArtTradable.deploy(
        'PricyERC1155',
        'PRCY',
        '20000000000000000000',
        TREASURY_ADDRESS,
        MARKETPLACE_PROXY_ADDRESS,
        BUNDLE_MARKETPLACE_PROXY_ADDRESS
    );
    await artTradable.deployed();
    console.log('PricyERC1155Tradable deployed to:', artTradable.address);

    const ArtTradablePrivate = await ethers.getContractFactory('PricyERC1155TradablePrivate');
    const artTradablePrivate = await ArtTradablePrivate.deploy(
        'IPricyERC1155',
        'IPRCY',
        '20000000000000000000',
        TREASURY_ADDRESS,
        MARKETPLACE_PROXY_ADDRESS,
        BUNDLE_MARKETPLACE_PROXY_ADDRESS
    );
    await artTradablePrivate.deployed();
    console.log('PricyERC1155TradablePrivate deployed to:', artTradablePrivate.address);
    ////////

    ////////
    const ArtFactory = await ethers.getContractFactory('PricyERC1155Factory');
    const artFactory = await ArtFactory.deploy(
        MARKETPLACE_PROXY_ADDRESS,
        BUNDLE_MARKETPLACE_PROXY_ADDRESS,
        '20000000000000000000',
        TREASURY_ADDRESS,
        '10000000000000000000'
     );
    await artFactory.deployed();
    console.log('PricyERC1155Factory deployed to:', artFactory.address);

    const ArtFactoryPrivate = await ethers.getContractFactory('PricyERC1155FactoryPrivate');
    const artFactoryPrivate = await ArtFactoryPrivate.deploy(
        MARKETPLACE_PROXY_ADDRESS,
        BUNDLE_MARKETPLACE_PROXY_ADDRESS,
        '20000000000000000000',
        TREASURY_ADDRESS,
        '10000000000000000000'
    );
    await artFactoryPrivate.deployed();
    console.log('PricyERC1155FactoryPrivate deployed to:', artFactoryPrivate.address);
    ////////
    
    await marketplace.updateAddressRegistry(PRICYCOM_ADDRESS_REGISTRY);   
    await bundleMarketplace.updateAddressRegistry(PRICYCOM_ADDRESS_REGISTRY);
    
    await auction.updateAddressRegistry(PRICYCOM_ADDRESS_REGISTRY);
    
    await addressRegistry.updatePricyCom(artion.address);
    await addressRegistry.updateAuction(auction.address);
    await addressRegistry.updateMarketplace(marketplace.address);
    await addressRegistry.updateBundleMarketplace(bundleMarketplace.address);
    await addressRegistry.updateNFTFactory(factory.address);
    await addressRegistry.updateTokenRegistry(tokenRegistry.address);
    await addressRegistry.updatePriceFeed(priceFeed.address);
    await addressRegistry.updateArtFactory(artFactory.address);   

    await tokenRegistry.add(WRAPPED_FTM);
    
    const finalbalance = await deployer.getBalance();
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
  

