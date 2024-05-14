// npx hardhat test ./test/HardhatOverAll.test.js --network localhost; 
// run first (in another shell): npx hardhat node
//   on Error: Cannot find module '@openzeppelin/test-helpers'
//     yarn add @openzeppelin/test-helpers
// if you prefer instead of MockVolcanoAuction you could install
// and get\increase timestamps, i.e.: await helpers.time.increase(3600);
const {
    expectRevert,
    expectEvent,
    BN,
    ether,
    constants,
    balance,
    send
  } = require('@openzeppelin/test-helpers');
//const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { ZERO_ADDRESS } = constants;

const {expect} = require('chai');

const VolcanoAddressRegistry = artifacts.require('VolcanoAddressRegistry');
const VolcanoERC721 = artifacts.require('MockVolcanoERC721Tradable');
const VolcanoAuction = artifacts.require('MockVolcanoAuction');
const VolcanoMarketplace = artifacts.require('VolcanoMarketplace');
const VolcanoMarketplaceUpgraded = artifacts.require('VolcanoMarketplaceUpgraded');
const VolcanoBundleMarketplace = artifacts.require('VolcanoBundleMarketplace');
const VolcanoERC721Factory = artifacts.require('VolcanoERC721Factory');
const VolcanoERC1155Factory = artifacts.require('VolcanoERC1155Factory');
const VolcanoTokenRegistry = artifacts.require('VolcanoTokenRegistry');
const VolcanoPriceFeed = artifacts.require('VolcanoPriceFeed');
const MockERC20 = artifacts.require('MockERC20');


const MARKETPLACE_MINT_COST = '50'  // 5%
const AUCTION_MINT_COST = '25'  // 5%
const MINT_COST = '2';  // ether

const weiToEther = (n) => {
    return web3.utils.fromWei(n.toString(), 'ether');
}

async function getGasCosts(receipt) {
    const tx = await web3.eth.getTransaction(receipt.tx);  
    const gasPrice = new BN(tx.gasPrice);
    return gasPrice.mul(new BN(receipt.receipt.gasUsed));
}    

contract('Overall Test',  function ([owner, platformFeeRecipient, artist, buyer, bidder1, bidder2, bidder3])  {
         
    const marketPlatformFee = web3.utils.toWei(MARKETPLACE_MINT_COST, 'wei');
    const auctionPlatformFee = web3.utils.toWei(AUCTION_MINT_COST, 'wei');    
    const mintCost = web3.utils.toWei(MINT_COST, 'ether');

    beforeEach(async function () {
        

        this.volcanoAddressRegistry = await VolcanoAddressRegistry.new();
        this.erc721nft = await VolcanoERC721.new(platformFeeRecipient, mintCost);

        //this.volcanoAuction = await VolcanoAuction.new();
        //await this.volcanoAuction.initialize(platformFeeRecipient, auctionPlatformFee);
        //await this.volcanoAuction.updatePlatformFee(actionPlatformFee);
        ////this.volcanoAuction = await deployProxy(VolcanoAuction, [platformFeeRecipient, auctionPlatformFee], { owner, initializer: 'initialize', kind: 'uups' });        
        const Auction = await ethers.getContractFactory('MockVolcanoAuction');
        this.volcanoAuctionEthers = await upgrades.deployProxy(Auction, [platformFeeRecipient, auctionPlatformFee], { initializer: 'initialize', kind: 'uups' });
        await this.volcanoAuctionEthers.waitForDeployment();
        this.volcanoAuctionEthers.address = await this.volcanoAuctionEthers.getAddress();  
        this.volcanoAuction = await VolcanoAuction.at(this.volcanoAuctionEthers.address);                    
        await this.volcanoAuction.updateAddressRegistry(this.volcanoAddressRegistry.address);

        //this.volcanoMarketplace = await VolcanoMarketplace.new();
        //await this.volcanoMarketplace.initialize(platformFeeRecipient, marketPlatformFee);
        ////this.volcanoMarketplace = await deployProxy(VolcanoMarketplace, [platformFeeRecipient, auctionPlatformFee], { owner, initializer: 'initialize', kind: 'uups' });        
        const Marketplace = await ethers.getContractFactory('VolcanoMarketplace');
        this.volcanoMarketplaceEthers = await upgrades.deployProxy(Marketplace, [platformFeeRecipient, marketPlatformFee], { initializer: 'initialize', kind: 'uups' });
        await this.volcanoMarketplaceEthers.waitForDeployment();
        this.volcanoMarketplaceEthers.address = await this.volcanoMarketplaceEthers.getAddress(); 
        this.volcanoMarketplace = await VolcanoMarketplace.at(this.volcanoMarketplaceEthers.address);      
        await this.volcanoMarketplace.updateAddressRegistry(this.volcanoAddressRegistry.address);

        //this.volcanoBundleMarketplace = await VolcanoBundleMarketplace.new();
        //await this.volcanoBundleMarketplace.initialize(platformFeeRecipient, marketPlatformFee);
        ////this.volcanoBundleMarketplace = await deployProxy(VolcanoBundleMarketplace, [platformFeeRecipient, auctionPlatformFee], { owner, initializer: 'initialize', kind: 'uups' });
        const BundleMarketplace = await ethers.getContractFactory('VolcanoBundleMarketplace');
        this.volcanoBundleMarketplaceEthers = await upgrades.deployProxy(BundleMarketplace, [platformFeeRecipient, marketPlatformFee], { initializer: 'initialize', kind: 'uups' });
        await this.volcanoBundleMarketplaceEthers.waitForDeployment();  
        this.volcanoBundleMarketplaceEthers.address = await this.volcanoBundleMarketplaceEthers.getAddress();  
        this.volcanoBundleMarketplace = await VolcanoBundleMarketplace.at(this.volcanoBundleMarketplaceEthers.address);           
        await this.volcanoBundleMarketplace.updateAddressRegistry(this.volcanoAddressRegistry.address);

        this.VolcanoERC721Factory = await VolcanoERC721Factory.new(this.volcanoAuction.address, this.volcanoMarketplace.address, this.volcanoBundleMarketplace.address, platformFeeRecipient, mintCost);
        this.volcanoTokenRegistry = await VolcanoTokenRegistry.new();

        this.mockERC20 = await MockERC20.new("wFTM", "wFTM", ether('1000000'));

        this.volcanoTokenRegistry.add(this.mockERC20.address);

        this.volcanoPriceFeed = await VolcanoPriceFeed.new(this.volcanoAddressRegistry.address, this.mockERC20.address);

        this.VolcanoERC1155Factory = await VolcanoERC1155Factory.new(this.volcanoAuction.address, this.volcanoMarketplace.address, this.volcanoBundleMarketplace.address, platformFeeRecipient, mintCost);

        //await this.volcanoAddressRegistry.updateVolcanoCom(this.erc721nft.address);
        await this.volcanoAddressRegistry.updateAuction(this.volcanoAuction.address);
        await this.volcanoAddressRegistry.updateMarketplace(this.volcanoMarketplace.address);
        await this.volcanoAddressRegistry.updateBundleMarketplace(this.volcanoBundleMarketplace.address);
        await this.volcanoAddressRegistry.updateErc721Factory(this.VolcanoERC721Factory.address);
        await this.volcanoAddressRegistry.updateTokenRegistry(this.volcanoTokenRegistry.address);
        await this.volcanoAddressRegistry.updatePriceFeed(this.volcanoPriceFeed.address);
        await this.volcanoAddressRegistry.updateErc1155Factory(this.VolcanoERC1155Factory.address);
    });
    
    describe('Proxy test', function() {
    
        it('MarketUpgrade', async function(){ 
        
        const oldAddress = this.volcanoMarketplace.address;
        const oldRegistryAddress = await this.volcanoMarketplace.addressRegistry();
        //console.log('old address = ', oldAddress, ' - registry: ', oldRegistryAddress);
        const MarketplaceUpgraded = await ethers.getContractFactory('VolcanoMarketplaceUpgraded');
        this.volcanoMarketplaceEthersUpgraded = await upgrades.upgradeProxy(this.volcanoMarketplaceEthers.address, MarketplaceUpgraded, { kind: 'uups' });
        await this.volcanoMarketplaceEthersUpgraded.waitForDeployment();
        this.volcanoMarketplaceEthersUpgraded.address = await this.volcanoMarketplaceEthersUpgraded.getAddress(); 
        this.volcanoMarketplace = await VolcanoMarketplaceUpgraded.at(this.volcanoMarketplaceEthersUpgraded.address); 
        const newAddress = this.volcanoMarketplace.address;
        const newRegistryAddress = await this.volcanoMarketplace.addressRegistry();
        //console.log('new address = ', newAddress, ' - registry: ', newRegistryAddress);
        expect(oldAddress).to.be.equal(newAddress); 
        expect(oldRegistryAddress).to.be.equal(newRegistryAddress); 
        expect(await this.volcanoMarketplace.version()).to.be.bignumber.equal('2');             
          
        }); 
    });
    
    describe('Minting and auctioning NFT', function() {
    
        for (t = 0; t <= 1; t = t+1) {
        
        let USE_ZERO_ADDRESS_TOKEN = (t == 0);
        
        it('Scenario 1', async function(){

            console.log(`
            Scenario 1:
            An artist mints an NFT for him/herself
            He/She then put it on the marketplace with price of 20 wFTMs
            A buyer then buys that NFT
            `);

            let addressBalance = await this.erc721nft.mintFee();
            console.log(`
            Platform Fee: ${weiToEther(addressBalance)}`);

            let addressBalance1 = await web3.eth.getBalance(artist);
            console.log(`
            FTM addressBalance of artist before minting: ${weiToEther(addressBalance1)}`);

            let addressBalance2 = await web3.eth.getBalance(platformFeeRecipient);
            console.log(`
            FTM addressBalance of the fee recipient before minting: ${weiToEther(addressBalance2)}`);

            console.log(`
            Now minting...`);
            let result = await this.erc721nft.mint(artist, 'http://artist.com/art.jpeg', {from: artist, value: ether(MINT_COST)});
                      
            console.log(`
            Minted successfully`);

            let addressBalance3 = await web3.eth.getBalance(artist);
            console.log(`
            FTM addressBalance of artist after minting: ${weiToEther(addressBalance3)}`);

            let addressBalance4 = await web3.eth.getBalance(platformFeeRecipient);
            console.log(`
            FTM addressBalance of recipient after minting: ${weiToEther(addressBalance4)}`);

            console.log(`
            *The difference of the artist's FTM addressBalance should be more than ${MINT_COST} FTM as 
            the platform fee is ${MINT_COST} FTM and minting costs some gases
            but should be less than ${MINT_COST}+1 FTM as the gas fees shouldn't be more than 1 FTM`);
            expect(weiToEther(addressBalance1)*1 - weiToEther(addressBalance3)*1).to.be.greaterThan(MINT_COST*1);
            expect(weiToEther(addressBalance1)*1 - weiToEther(addressBalance3)*1).to.be.lessThan(MINT_COST*1 + 1);

            console.log(`
            *The difference of the recipients's FTM addressBalance should be ${MINT_COST} FTM as the platform fee is ${MINT_COST} FTM `);
            expect(weiToEther(addressBalance4)*1 - weiToEther(addressBalance2)*1).to.be.equal(MINT_COST*1);

            console.log(`
            *Event Minted should be emitted with correct values: 
            tokenId = 1, 
            beneficiary = ${artist}, 
            tokenUri = ${'http://artist.com/art.jpeg'},
            minter = ${artist}`);
            expectEvent(result, 'Minted',{
                tokenId: '1',
                beneficiary: artist,
                tokenUri : 'http://artist.com/art.jpeg',
                minter : artist
            });

            console.log(`
            *The artist approves the nft to the market`);
            await this.erc721nft.setApprovalForAll(this.volcanoMarketplace.address, true, {from: artist});

            console.log(`
            *The artist lists the nft in the market with price 20 wFTM and starting time 2021-09-22 10:00:00 GMT`);
            
            await this.volcanoMarketplace.listItem(
                    this.erc721nft.address,
                    new BN('1'),
                    new BN('1'),
                    USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                    web3.utils.toWei('20', 'ether'),
                    new BN('1632304800'), // 2021-09-22 10:00:00 GMT
                    { from : artist }
                    );
            
            let listing = await this.volcanoMarketplace.listings(this.erc721nft.address, new BN('1'), artist);
            
            console.log(`
            *The nft should be on the marketplace listing`);
            expect(listing.quantity.toString()).to.be.equal('1');
            expect(listing.payToken).to.be.equal(USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address);
            expect(weiToEther(listing.pricePerItem)*1).to.be.equal(20);
            expect(listing.startingTime.toString()).to.be.equal('1632304800');

            const buyerTracker = await balance.tracker(buyer);
            const artistTracker = await balance.tracker(artist);
            
            if (!USE_ZERO_ADDRESS_TOKEN)
            {
              console.log(`
              Mint 50 wFTMs to buyer so he can buy the nft`);
              await this.mockERC20.mint(buyer, web3.utils.toWei('50', 'ether'));
              console.log(`
              Buyer approves VolcanoMarketplace to transfer up to 50 wFTM`);              
              await this.mockERC20.approve(this.volcanoMarketplace.address, web3.utils.toWei('50', 'ether'), {from: buyer});
            }
            
            console.log(`
            Buyer buys the nft for 20 wFTMs. Balance is: `, weiToEther(USE_ZERO_ADDRESS_TOKEN ? await web3.eth.getBalance(buyer) : await this.mockERC20.balanceOf(buyer)));
            
            result = await this.volcanoMarketplace.buyItem(
                this.erc721nft.address, 
                new BN('1'), 
                USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address, 
                artist, 
                { from: buyer,
                  value: USE_ZERO_ADDRESS_TOKEN ? web3.utils.toWei('20', 'ether') : 0
                });
            
            console.log(`
            *Event ItemSold should be emitted with correct values: 
            seller = ${artist}, 
            buyer = ${buyer}, 
            nft = ${this.erc721nft.address},
            tokenId = 1,
            quantity = 1,
            payToken = ${USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address},
            payTokenPrice = 0,
            pricePerItem = 20`);
            
            expectEvent(result, 'ItemSold',{
                seller: artist,
                buyer: buyer,
                nft : this.erc721nft.address,
                tokenId : web3.utils.toBN('1'),
                quantity : web3.utils.toBN('1'),
                payToken : USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                payTokenPrice : ether('0'),
                pricePerItem : ether('20')
            });

            if (USE_ZERO_ADDRESS_TOKEN)
            {
              expect(await buyerTracker.delta()).to.be.bignumber.equal(ether('20').add(await getGasCosts(result)).mul(web3.utils.toBN('-1')));
            } else {
              addressBalance = await this.mockERC20.balanceOf(buyer);
              console.log(`
              *The wFTM addressBalance of buyer now should be 30 wFTMs`);
              expect(weiToEther(addressBalance)*1).to.be.equal(30);
            }

            let nftOwner = await this.erc721nft.ownerOf(web3.utils.toBN('1'));
            console.log(`
            The owner of the nft now should be the buyer`);
            expect(nftOwner).to.be.equal(buyer);
            
            if (USE_ZERO_ADDRESS_TOKEN)
            {
              expect(await artistTracker.delta()).to.be.bignumber.equal(ether('19'));
            } else {            
              addressBalance = await this.mockERC20.balanceOf(artist);
              console.log(`
              *The wFTM addressBalance of the artist should be 19 wFTMs`);
              expect(weiToEther(addressBalance)*1).to.be.equal(19);
            }

            listing = await this.volcanoMarketplace.listings(this.erc721nft.address, web3.utils.toBN('1'), artist);
            console.log(`
            *The nft now should be removed from the listing`);            
            expect(listing.quantity.toString()).to.be.equal('0');
            expect(listing.payToken).to.be.equal(constants.ZERO_ADDRESS);
            expect(weiToEther(listing.pricePerItem)*1).to.be.equal(0);
            expect(listing.startingTime.toString()).to.be.equal('0');

            console.log('');
        });

        it('Scenario 2', async function() {

            console.log(`
            Scenario 2:
            An artist mints an NFT from him/herself
            He/She then put it on an auction with reserve price of 20 wFTMs
            Bidder1, bidder2, bidder3 then bid the auction with 20 wFTMs, 25 wFTMs, and 30 wFTMs respectively`);

            let addressBalance = await this.erc721nft.mintFee();
            console.log(`
            Platform Fee: ${weiToEther(addressBalance)}`);

            let addressBalance1 = await web3.eth.getBalance(artist);
            console.log(`
            FTM addressBalance of artist before minting: ${weiToEther(addressBalance1)}`);

            let addressBalance2 = await web3.eth.getBalance(platformFeeRecipient);
            console.log(`
            FTM addressBalance of the fee recipient before minting: ${weiToEther(addressBalance2)}`);

            console.log(`
            Now minting...`);
            let result = await this.erc721nft.mint(artist, 'http://artist.com/art.jpeg', {from: artist, value: ether(MINT_COST)});
            console.log(`
            Minted successfully`);

            let addressBalance3 = await web3.eth.getBalance(artist);
            console.log(`
            FTM addressBalance of artist after minting: ${weiToEther(addressBalance3)}`);

            let addressBalance4 = await web3.eth.getBalance(platformFeeRecipient);
            console.log(`
            FTM addressBalance of recipient after minting: ${weiToEther(addressBalance4)}`);

            console.log(`
            *The difference of the artist's FTM addressBalance should be more than ${MINT_COST} FTMs as 
            the platform fee is ${MINT_COST} FTM and minting costs some gases
            but should be less than ${MINT_COST + 1} FTM as the gas fees shouldn't be more than 1 FTM`);
            expect(weiToEther(addressBalance1)*1 - weiToEther(addressBalance3)*1).to.be.greaterThan(MINT_COST*1);
            expect(weiToEther(addressBalance1)*1 - weiToEther(addressBalance3)*1).to.be.lessThan(MINT_COST*1 + 1);

            console.log(`
            *The difference of the recipients's FTM addressBalance should be ${MINT_COST} FTMs as the platform fee is ${MINT_COST} FTMs `);
            expect(weiToEther(addressBalance4)*1 - weiToEther(addressBalance2)*1).to.be.equal(MINT_COST*1);

            console.log(`
            *Event Minted should be emitted with correct values: 
            tokenId = 1, 
            beneficiary = ${artist}, 
            tokenUri = ${'http://artist.com/art.jpeg'},
            minter = ${artist}`);
            expectEvent(result, 'Minted',{
                tokenId: web3.utils.toBN('1'),
                beneficiary: artist,
                tokenUri : 'http://artist.com/art.jpeg',
                minter : artist
            });

            console.log(`
            The artist approves the nft to the market`);
            await this.erc721nft.setApprovalForAll(this.volcanoAuction.address, true, {from: artist});

            console.log(`
            Let's mock that the current time: 2021-09-25 09:00:00`);
            await this.volcanoAuction.setTime(web3.utils.toBN('1632560400'));

            console.log(`
            The artist auctions his nfts with reserve price of 20 wFTMs`);
            result =  await this.volcanoAuction.createAuction(
                this.erc721nft.address,
                web3.utils.toBN('1'),
                USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                ether('20'),
                web3.utils.toBN('1632564000'),  //2021-09-25 10:00:00
                false,
                web3.utils.toBN('1632996000'),   //2021-09-30 10:00:00
                { from: artist }
            );

            console.log(`
            *Event AuctionCreated should be emitted with correct values: 
            nftAddress = ${this.erc721nft.address}, 
            tokenId = 1, 
            payToken = ${USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address}`);
            expectEvent(result, 'AuctionCreated',{
                nftAddress: this.erc721nft.address,
                tokenId: web3.utils.toBN('1'),
                payToken: USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address
            });

            if (USE_ZERO_ADDRESS_TOKEN)
            {

            } else {
              console.log(`
              Mint 50 wFTMs to bidder1 so he can bid the auctioned nft`);
              await this.mockERC20.mint(bidder1, ether('50'));
  
              console.log(`
              Bidder1 approves VolcanoAuction to transfer up to 50 wFTM`);
              await this.mockERC20.approve(this.volcanoAuction.address, ether('50'), {from: bidder1});
  
              console.log(`
              Mint 50 wFTMs to bidder2 so he can bid the auctioned nft`);
              await this.mockERC20.mint(bidder2, ether('50'));
  
              console.log(`
              Bidder2 approves VolcanoAuction to transfer up to 50 wFTM`);
              await this.mockERC20.approve(this.volcanoAuction.address, ether('50'), {from: bidder2});
  
              console.log(`
              Mint 50 wFTMs to bidder3 so he can bid the auctioned nft`);
              await this.mockERC20.mint(bidder3, ether('50'));
  
              console.log(`
              Bidder3 approves VolcanoAuction to transfer up to 50 wFTM`);
              await this.mockERC20.approve(this.volcanoAuction.address, ether('50'), {from: bidder3});
            }
            
            const bidder1Tracker = await balance.tracker(bidder1);
            const bidder2Tracker = await balance.tracker(bidder2);
            const bidder3Tracker = await balance.tracker(bidder3);     
            const platformFeeRecipientTracker = await balance.tracker(platformFeeRecipient);
            const artistTracker = await balance.tracker(artist);
            
            console.log(`
            Let's mock that the current time: 2021-09-25 10:30:00`);
            await this.volcanoAuction.setTime(web3.utils.toBN('1632565800'));

            console.log(`
            Bidder1 place a bid of 20 wFTMs`);
            result = await this.volcanoAuction.placeBid(this.erc721nft.address, web3.utils.toBN('1'), ether('20'), { from: bidder1, value: USE_ZERO_ADDRESS_TOKEN ? ether('20') : 0 });

            if (USE_ZERO_ADDRESS_TOKEN)
            {
              expect(await bidder1Tracker.delta()).to.be.bignumber.equal(ether('20').add(await getGasCosts(result)).mul(web3.utils.toBN('-1')));              
            } else {
              addressBalance = await this.mockERC20.balanceOf(bidder1);
              console.log(`
              *Bidder1's wFTM addressBalance after bidding should be 30 wFTMs`);
              expect(weiToEther(addressBalance)*1).to.be.equal(30);
            }

            console.log(`
            Bidder2 place a bid of 25 wFTMs`);
            result = await this.volcanoAuction.placeBid(this.erc721nft.address, web3.utils.toBN('1'), ether('25'), { from: bidder2, value: USE_ZERO_ADDRESS_TOKEN ? ether('25') : 0 });

            if (USE_ZERO_ADDRESS_TOKEN)
            {
              expect(await bidder1Tracker.delta()).to.be.bignumber.equal(ether('20'));
              expect(await bidder2Tracker.delta()).to.be.bignumber.equal(ether('25').add(await getGasCosts(result)).mul(web3.utils.toBN('-1')));
            } else {
              addressBalance = await this.mockERC20.balanceOf(bidder1);
              console.log(`
              *Bidder1's wFTM addressBalance after bidder2 outbid should be back to 50 wFTMs`);
              expect(weiToEther(addressBalance)*1).to.be.equal(50);
              
              addressBalance = await this.mockERC20.balanceOf(bidder2);
              console.log(`
              *Bidder2's wFTM addressBalance after bidding should be 25`);
              expect(weiToEther(addressBalance)*1).to.be.equal(25);                          
            }

            console.log(`
            Bidder3 place a bid of 30 wFTMs`);
            result = await this.volcanoAuction.placeBid(this.erc721nft.address, web3.utils.toBN('1'), ether('30'), { from: bidder3, value: USE_ZERO_ADDRESS_TOKEN ? ether('30') : 0 });

            if (USE_ZERO_ADDRESS_TOKEN)
            {
              expect(await bidder2Tracker.delta()).to.be.bignumber.equal(ether('25'));
              expect(await bidder3Tracker.delta()).to.be.bignumber.equal(ether('30').add(await getGasCosts(result)).mul(web3.utils.toBN('-1')));
            } else {
              addressBalance = await this.mockERC20.balanceOf(bidder2);
              console.log(`
              *Bidder2's wFTM addressBalance after bidder3 outbid should be back to 50 wFTMs`);
              expect(weiToEther(addressBalance)*1).to.be.equal(50);
  
              addressBalance = await this.mockERC20.balanceOf(bidder3);
              console.log(`
              *Bidder3's wFTM addressBalance after bidding should be 20`);
              expect(weiToEther(addressBalance)*1).to.be.equal(20);
            }

            console.log(`
            Let's mock that the current time: 2021-09-30 11:00:00 so the auction has ended`);
            await this.volcanoAuction.setTime(web3.utils.toBN('1632999600'));

            console.log(`
            The artist tries to make the auction complete`);
            result = await this.volcanoAuction.resultAuction(this.erc721nft.address, web3.utils.toBN('1'), {from : artist});

            if (USE_ZERO_ADDRESS_TOKEN)
            {
              expect(await platformFeeRecipientTracker.delta()).to.be.bignumber.equal(ether('0.25'));
              expect(await artistTracker.delta()).to.be.bignumber.equal(ether('29.75').sub(await getGasCosts(result)));
            } else {
              console.log(`
              *As the mintCost is 2.5%, the platform fee recipient should get 2.5% of (30 - 20) which is 0.25 wFTM.`);
              addressBalance = await this.mockERC20.balanceOf(platformFeeRecipient);
              expect(weiToEther(addressBalance)*1).to.be.equal(0.25);
  
              console.log(`
              *The artist should get 29.75 wFTM.`);
              addressBalance = await this.mockERC20.balanceOf(artist);
              expect(weiToEther(addressBalance)*1).to.be.equal(29.75);
            }
            
            let nftOwner = await this.erc721nft.ownerOf(web3.utils.toBN('1'));
            console.log(`
            *The owner of the nft now should be the bidder3`);
            expect(nftOwner).to.be.equal(bidder3);

            console.log(`
            *Event AuctionResulted should be emitted with correct values: 
            nftAddress = ${this.erc721nft.address}, 
            tokenId = 1,
            winner = ${bidder3} ,
            payToken = ${USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address},
            payTokenPrice = 0,
            winningBid = 30`);
            expectEvent(result, 'AuctionResulted',{
                nftAddress: this.erc721nft.address,
                tokenId: web3.utils.toBN('1'),
                winner: bidder3,
                payToken: USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                payTokenPrice: ether('0'),
                winningBid: ether('30')
            });

        })

        it('Scenario 3', async function() {

            console.log(`
            Scenario 3:
            An artist mints two NFTs from him/herself
            He/She then put them on the marketplace as bundle price of 20 wFTMs
            A buyer then buys them for 20 wFTMs`);

            let addressBalance = await this.erc721nft.mintFee();
            console.log(`
            Platform Fee: ${weiToEther(addressBalance)}`);

            let addressBalance1 = await web3.eth.getBalance(artist);
            console.log(`
            FTM addressBalance of artist before minting: ${weiToEther(addressBalance1)}`);

            let addressBalance2 = await web3.eth.getBalance(platformFeeRecipient);
            console.log(`
            FTM addressBalance of the fee recipient before minting: ${weiToEther(addressBalance2)}`);

            console.log(`
            Now minting the first NFT...`);
            let result = await this.erc721nft.mint(artist, 'http://artist.com/art.jpeg', {from: artist, value: ether(MINT_COST)});
            console.log(`
            NFT1 minted successfully`);

            console.log(`
            *Event Minted should be emitted with correct values: 
            tokenId = 1, 
            beneficiary = ${artist}, 
            tokenUri = ${'http://artist.com/art.jpeg'},
            minter = ${artist}`);
            expectEvent(result, 'Minted',{
                tokenId: web3.utils.toBN('1'),
                beneficiary: artist,
                tokenUri : 'http://artist.com/art.jpeg',
                minter : artist
            });

            console.log(`
            Now minting the second NFT...`);
            result = await this.erc721nft.mint(artist, 'http://artist.com/art2.jpeg', {from: artist, value: ether(MINT_COST)});
            console.log(`
            NFT2 minted successfully`);

            console.log(`
            *Event Minted should be emitted with correct values: 
            tokenId = 2, 
            beneficiary = ${artist}, 
            tokenUri = ${'http://artist.com/art2.jpeg'},
            minter = ${artist}`);
            expectEvent(result, 'Minted',{
                tokenId: web3.utils.toBN('2'),
                beneficiary: artist,
                tokenUri : 'http://artist.com/art2.jpeg',
                minter : artist
            });

            let addressBalance3 = await web3.eth.getBalance(artist);
            console.log(`
            FTM addressBalance of artist after minting: ${weiToEther(addressBalance3)}`);

            let addressBalance4 = await web3.eth.getBalance(platformFeeRecipient);
            console.log(`
            FTM addressBalance of recipient after minting: ${weiToEther(addressBalance4)}`);

            console.log(`
            *The difference of the artist's FTM addressBalance should be more than ${2*MINT_COST} FTMs as 
            the platform fee is ${MINT_COST} FTM and minting costs some gases
            but should be less than ${MINT_COST + 1} FTM as the gas fees shouldn't be more than 1 FTM`);
            expect(weiToEther(addressBalance1)*1 - weiToEther(addressBalance3)*1).to.be.greaterThan(MINT_COST*2);
            expect(weiToEther(addressBalance1)*1 - weiToEther(addressBalance3)*1).to.be.lessThan(MINT_COST*2 + 1);

            console.log(`
            *The difference of the recipients's FTM addressBalance should be ${MINT_COST*2} FTMs as the platform fee is ${MINT_COST} FTMs `);
            expect(weiToEther(addressBalance4)*1 - weiToEther(addressBalance2)*1).to.be.equal(MINT_COST*2);            

            console.log(`
            The artist approves the nft to the market`);
            await this.erc721nft.setApprovalForAll(this.volcanoBundleMarketplace.address, true, {from: artist});

            console.log(`
            The artist lists the 2 nfts in the bundle market with price 20 wFTM and 
            starting time 2021-09-22 10:00:00 GMT`);
            await this.volcanoBundleMarketplace.listItem(
                    'mynfts',
                    [this.erc721nft.address, this.erc721nft.address],
                    [web3.utils.toBN('1'),web3.utils.toBN('2')],
                    [web3.utils.toBN('1'), web3.utils.toBN('1')],
                    USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                    ether('20'),
                    web3.utils.toBN('1632304800'), // 2021-09-22 10:00:00 GMT
                    { from : artist }
                    );

            let listing = await this.volcanoBundleMarketplace.getListing(artist, 'mynfts');
            //console.log(listing);
            console.log(`
            *The nfts should be on the bundle marketplace listing`);
            expect(listing.nfts.length).to.be.equal(2);
            expect(listing.nfts[0]).to.be.equal(this.erc721nft.address);
            expect(listing.nfts[1]).to.be.equal(this.erc721nft.address);
            expect(listing.tokenIds[0].toString()).to.be.equal('1');
            expect(listing.tokenIds[1].toString()).to.be.equal('2');
            expect(listing.quantities[0].toString()).to.be.equal('1');
            expect(listing.quantities[1].toString()).to.be.equal('1');
            //expect(listing.payToken).to.be.equal(this.mockERC20.address);
            expect(weiToEther(listing.price)*1).to.be.equal(20);
            expect(listing.startingTime.toString()).to.be.equal('1632304800');

            const artistTracker = await balance.tracker(artist);
            const platformFeeRecipientTracker = await balance.tracker(platformFeeRecipient);            
            
            if (!USE_ZERO_ADDRESS_TOKEN) {
              console.log(`
              Mint 50 wFTMs to buyer so he can buy the two nfts`);
              await this.mockERC20.mint(buyer, ether('50'));
  
              console.log(`
              The buyer approves VolcanoBundleMarketplace to transfer up to 50 wFTM`);
              await this.mockERC20.approve(this.volcanoBundleMarketplace.address, ether('50'), {from: buyer});
            }
            
            console.log(`
            The buyer buys the nft for 20 wFTMs`);
            result = await this.volcanoBundleMarketplace.buyItem(
                'mynfts', 
                USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address, 
                { from: buyer,
                  value: USE_ZERO_ADDRESS_TOKEN ? ether('20') : 0
                });
                
            console.log(`
            *Event ItemSold should be emitted with correct values: 
            seller = ${artist}, 
            buyer = ${buyer}, 
            bundleId = ${'mynfts'},
            payToken = ${USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address},
            payTokenPrice = ${ether('0')},
            price = ${ether('20')}`);
            expectEvent(result, 'ItemSold',{
                seller: artist,
                buyer: buyer,
                bundleID : 'mynfts',
                payToken : USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                payTokenPrice: ether('0'),
                price: ether('20')
                });
                
            console.log(`
            *The two nfts now should belong to buyer`);
            let nftOwner = await this.erc721nft.ownerOf(web3.utils.toBN('1'));
            expect(nftOwner).to.be.equal(buyer);
            nftOwner = await this.erc721nft.ownerOf(web3.utils.toBN('2'));
            expect(nftOwner).to.be.equal(buyer);
            
            if (USE_ZERO_ADDRESS_TOKEN) {
              expect(await artistTracker.delta()).to.be.bignumber.equal(ether('19'));
              expect(await platformFeeRecipientTracker.delta()).to.be.bignumber.equal(ether('1'));
            } else {
              console.log(`
              *The artist's wFTM addressBalance now should be 19 wTFM`);
              addressBalance = await this.mockERC20.balanceOf(artist);
              expect(weiToEther(addressBalance)*1).to.be.equal(19);

              console.log(`
              *The platform fee recipient's wFTM addressBalance now should be 1 wTFM`);
              addressBalance = await this.mockERC20.balanceOf(platformFeeRecipient);
              expect(weiToEther(addressBalance)*1).to.be.equal(1);
            }

        })      
      }  // for
    });
});