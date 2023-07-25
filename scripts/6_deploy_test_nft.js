const {
  TREASURY_ADDRESS,
  AUCTION,
  MARKETPLACE,
  BUNDLE_MARKETPLACE
} = require('./constants');

async function main() {
  const NFTTradable = await ethers.getContractFactory('PricyERC721Tradable');
  const nft = await NFTTradable.deploy(
    'PricyERC721',
    'PRY',
    AUCTION,
    MARKETPLACE,
    BUNDLE_MARKETPLACE,
    '10000000000000000000',
    TREASURY_ADDRESS
  );
  await nft.deployed();
  console.log('PricyERC721Tradable deployed to:', nft.address);

  const NFTTradablePrivate = await ethers.getContractFactory('PricyERC721TradablePrivate');
  const nftPrivate = await NFTTradablePrivate.deploy(
    'PricyERC721',
    'IPRY',
    AUCTION,
    MARKETPLACE,
    BUNDLE_MARKETPLACE,
    '10000000000000000000',
    TREASURY_ADDRESS
  );
  await nftPrivate.deployed();
  console.log('PricyERC721TradablePrivate deployed to:', nftPrivate.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
