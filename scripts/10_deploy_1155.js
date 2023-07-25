const {
  TREASURY_ADDRESS,
  MARKETPLACE,
  BUNDLE_MARKETPLACE
} = require('./constants');

async function main() {
  const ArtTradable = await ethers.getContractFactory('PricyERC1155Tradable');
  const nft = await ArtTradable.deploy(
    'PricyERC1155',
    'PRCY',
    '20000000000000000000',
    TREASURY_ADDRESS,
    MARKETPLACE,
    BUNDLE_MARKETPLACE
  );
  await nft.deployed();
  console.log('PricyComTradable deployed to:', nft.address);

  const ArtTradablePrivate = await ethers.getContractFactory('PricyERC1155TradablePrivate');
  const nftPrivate = await ArtTradablePrivate.deploy(
    'IPricyERC1155',
    'IPRCY',
    '20000000000000000000',
    TREASURY_ADDRESS,
    MARKETPLACE,
    BUNDLE_MARKETPLACE
  );
  await nftPrivate.deployed();
  console.log('PricyERC1155TradablePrivate deployed to:', nftPrivate.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
