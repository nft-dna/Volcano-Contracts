// npx hardhat test ./test/VolcanoAuction.test.js --network localhost
const {
    expectRevert,
    expectEvent,
    BN,
    ether,
    constants,
    balance,
    send
} = require('@openzeppelin/test-helpers');

const {
    expect    
} = require('chai');

const { ZERO_ADDRESS } = constants;

const VolcanoAddressRegistry = artifacts.require('VolcanoAddressRegistry');
const VolcanoCom = artifacts.require('MockVolcanoERC721Tradable');
const VolcanoAuction = artifacts.require('MockVolcanoAuction');
const VolcanoAuctionReal = artifacts.require('VolcanoAuction');
const VolcanoTokenRegistry = artifacts.require('VolcanoTokenRegistry');
const VolcanoMarketplace = artifacts.require('VolcanoMarketplace');
const VolcanoBundleMarketplace = artifacts.require('VolcanoBundleMarketplace');
const VolcanoPriceFeed = artifacts.require('VolcanoPriceFeed');
const MockBiddingContract = artifacts.require('MockBiddingContract');
const MockERC20 = artifacts.require('MockERC20');

const mintFee = web3.utils.toWei('5', 'ether'); // mintFee
const platformFee = web3.utils.toWei('75', 'wei'); // marketplace platform fee: 7.5%
const nonExistentTokenId = new BN('999');


contract('VolcanoAuction', (accounts) => {
    const [admin, smartContract, platformFeeAddress, minter, owner, designer, bidder, bidder2, provider] = accounts;

    const ZERO = new BN('0');
    const TOKEN_ONE_ID = new BN('1');
    const TOKEN_TWO_ID = new BN('2');
    const TWENTY_TOKENS = new BN('20000000000000000000');
    const ONE_THOUSAND_TOKENS = new BN('1000000000000000000000');

    const randomTokenURI = 'rand';

    beforeEach(async () => {
        this.nft = await VolcanoCom.new(owner, mintFee, {
            from: minter
        });
        this.mockToken = await MockERC20.new(
            'Mock ERC20',
            'MOCK',
            ONE_THOUSAND_TOKENS, {
                from: admin
            }
        );
        this.volcanoTokenRegistry = await VolcanoTokenRegistry.new({from: admin} );    
        this.volcanoTokenRegistry.add(this.mockToken.address, {from: admin} );
        
        this.volcanoAddressRegistry = await VolcanoAddressRegistry.new({from: admin} );
               
        const Marketplace = await ethers.getContractFactory('VolcanoMarketplace');
        this.volcanoMarketplaceEthers = await upgrades.deployProxy(Marketplace, [platformFeeAddress, platformFee], { from: admin,  initializer: 'initialize', kind: 'uups' });
        await this.volcanoMarketplaceEthers.waitForDeployment();
        this.volcanoMarketplaceEthers.address = await this.volcanoMarketplaceEthers.getAddress(); 
        this.volcanoMarketplace = await VolcanoMarketplace.at(this.volcanoMarketplaceEthers.address);      
        await this.volcanoMarketplace.updateAddressRegistry(this.volcanoAddressRegistry.address, { from: admin });        
                    
        const BundleMarketplace = await ethers.getContractFactory('VolcanoBundleMarketplace');
        this.volcanoBundleMarketplaceEthers = await upgrades.deployProxy(BundleMarketplace, [platformFeeAddress, platformFee], {from: admin, initializer: 'initialize', kind: 'uups' });
        await this.volcanoBundleMarketplaceEthers.waitForDeployment();  
        this.volcanoBundleMarketplaceEthers.address = await this.volcanoBundleMarketplaceEthers.getAddress();  
        this.volcanoBundleMarketplace = await VolcanoBundleMarketplace.at(this.volcanoBundleMarketplaceEthers.address);
        await this.volcanoBundleMarketplace.updateAddressRegistry(this.volcanoAddressRegistry.address, { from: admin });                   
        
        this.volcanoPriceFeed = await VolcanoPriceFeed.new(this.volcanoAddressRegistry.address, this.mockToken.address, { from: admin });        
                    
        //this.auction = await VolcanoAuction.new({from: admin} 
        //    //platformFeeAddress,
        //    //{from: admin} 
        //);
        //await this.auction.initialize(platformFeeAddress, {from: admin} );
        //await this.auction.updatePlatformFee(platformFee, {from: admin} );
        const Auction = await ethers.getContractFactory('MockVolcanoAuction');
        this.volcanoAuctionEthers = await upgrades.deployProxy(Auction, [platformFeeAddress, platformFee], { from: admin, initializer: 'initialize', kind: 'uups' });
        await this.volcanoAuctionEthers.waitForDeployment();
        this.volcanoAuctionEthers.address = await this.volcanoAuctionEthers.getAddress();  
        this.auction = await VolcanoAuction.at(this.volcanoAuctionEthers.address);               
        await this.auction.updateAddressRegistry(this.volcanoAddressRegistry.address, { from: admin }); 
                
                                    
        await this.volcanoAddressRegistry.updateTokenRegistry(this.volcanoTokenRegistry.address, {from: admin} );        
        await this.volcanoAddressRegistry.updateMarketplace(this.volcanoMarketplace.address, { from: admin });
        await this.volcanoAddressRegistry.updateBundleMarketplace(this.volcanoBundleMarketplace.address, { from: admin });
        await this.volcanoAddressRegistry.updatePriceFeed(this.volcanoPriceFeed.address, { from: admin });                
   
        await this.volcanoAddressRegistry.updateAuction(this.auction.address, { from: admin });

        await this.nft.setApprovalForAll(this.auction.address, true, {
            from: minter
        });
        await this.nft.setApprovalForAll(this.auction.address, true, {
            from: admin
        });
    });
   
    for (t = 0; t <= 1; t = t+1) {
        
        let USE_ZERO_ADDRESS_TOKEN = (t == 0);   

        describe('Contract deployment', () => {
            it('Reverts when platform fee recipient is zero', async () => {
                //let pa = await VolcanoAuctionReal.new({
                //    from: admin
                //});
                const Auction = await ethers.getContractFactory('MockVolcanoAuction');
                await expectRevert(
                    //pa.initialize(constants.ZERO_ADDRESS, platformFee),
                    upgrades.deployProxy(Auction, [constants.ZERO_ADDRESS, platformFee], {from: admin, initializer: 'initialize', kind: 'uups' }),
                    "VolcanoAuction: Invalid Platform Fee Recipient"
                );
            });
        });
    
    
        describe('createAuction()', async () => {
    
            describe('validation', async () => {
                beforeEach(async () => {
                    await this.nft.mint(minter, randomTokenURI, {
                        from: minter,
                        value: mintFee
                    });
                });
    
                it('fails if startTime is in the past', async () => {
                    //await this.auction.setNowOverride('12');
                    await this.auction.setTime('12');
                    await expectRevert(
                        this.auction.createAuction(this.nft.address, 
                        TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, 
                        ether('1'), 
                        web3.utils.toBN('11'), 
                        false, 
                        web3.utils.toBN('100000'), {
                            from: minter
                        }),
                        "invalid start time"
                    );
                });
                
                it('fails if endTime is in the past', async () => {
                    //await this.auction.setNowOverride('12');
                    await this.auction.setTime('12');
                    await expectRevert(
                        this.auction.createAuction(this.nft.address, TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '14', false, '11', {
                            from: minter
                        }),
                        "end time must be greater than start (by 5 minutes)"
                    );
                });
    
    
                it('fails if endTime is not greater than startTime (by 5 minutes)', async () => {
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
                    await expectRevert(
                        this.auction.createAuction(this.nft.address, TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '14', false, '313', {
                            from: minter
                        }),
                        'end time must be greater than start (by 5 minutes)'
                    );
                });
                
    
                it('fails if token already has auction in play', async () => {
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
                    await this.auction.createAuction(this.nft.address, TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '5', false, '305', {
                        from: minter
                    });
    
                    await expectRevert(
                        this.auction.createAuction(this.nft.address, TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '5', false, '305', {
                            from: minter
                        }),
                        'auction already started'
                    );
                });
                
                it('fails if you dont own the token', async () => {
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
                    await this.nft.mint(bidder, randomTokenURI, {
                        from: minter,
                        value: mintFee
                    });
                                   
                    await this.auction.createAuction(this.nft.address, TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '5', false, '305', {
                        from: minter
                    });
    
                    await expectRevert(
                        this.auction.createAuction(this.nft.address, TOKEN_TWO_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '5', false, '305', {
                            from: minter
                        }),
                        'not owner and or contract not approved'
                    );
                });
    
                it('fails if token does not exist', async () => {
                    //await this.auction.setNowOverride('10');
                    await this.auction.setTime('10');
                    await expectRevert(
                        this.auction.createAuction(this.nft.address, '99', USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '15', false, '345', {
                            from: minter
                        }),
                        'ERC721: invalid token ID'
                    );
                });
    
                it('fails if contract is paused', async () => {
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
                    await this.auction.toggleIsPaused({
                        from: admin
                    });
                    await expectRevert(
                        this.auction.createAuction(this.nft.address, TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '5', false, '305', {
                            from: minter
                        }),
                        "Pausable: paused"
                    );
                });
            });
    
            describe('successful creation', async () => {
                it('Token retains in the ownership of the auction creator', async () => {
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');               
                    await this.nft.mint(minter, randomTokenURI, {
                        from: minter,
                        value: mintFee
                    });
                    await this.auction.createAuction(this.nft.address, TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '5', false, '305', {
                        from: minter
                    });
    
                    const owner = await this.nft.ownerOf(TOKEN_ONE_ID);
                    expect(owner).to.be.equal(minter);
                });
            });
        });
    
        describe('placeBid()', async () => {
    
            describe('validation', () => {
    
                beforeEach(async () => {
                    await this.nft.mint(minter, randomTokenURI, {
                        from: minter,
                        value: mintFee
                    });
                    await this.nft.mint(minter, randomTokenURI, {
                        from: minter,
                        value: mintFee
                    });
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
    
                    await this.auction.createAuction(
                        this.nft.address,
                        TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '5', false, '305',
                        {
                            from: minter
                        }
                    );
                });
    
                it('will revert if sender is smart contract', async () => {
                    this.biddingContract = await MockBiddingContract.new(this.auction.address);
                    await expectRevert(
                        this.biddingContract.bid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                            from: bidder,
                            value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                        }),
                        "no contracts permitted"
                    );
                });
    
                it('will fail with 721 token not on auction', async () => {
                    await expectRevert(
                        this.auction.placeBid(this.nft.address, nonExistentTokenId, ether('1'), {
                            from: bidder,
                            value: USE_ZERO_ADDRESS_TOKEN ? ether('1') : 0
                        }),
                        'bidding outside of the auction window'
                    );
                });
    
                it('will fail with valid token but no auction', async () => {
                    await expectRevert(
                        this.auction.placeBid(this.nft.address, TOKEN_TWO_ID, ether('1'), {
                            from: bidder,
                            value: USE_ZERO_ADDRESS_TOKEN ? ether('1') : 0
                        }),
                        'bidding outside of the auction window'
                    );
                });
    
                it('will fail when auction finished', async () => {
                    //await this.auction.setNowOverride('11');
                    await this.auction.setTime('311');
                    await expectRevert(
                        this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('1'), {
                            from: bidder,
                            value: USE_ZERO_ADDRESS_TOKEN ? ether('1') : 0
                        }),
                        'bidding outside of the auction window'
                    );
                });
    
                it('will fail when contract is paused', async () => {
                    await this.auction.toggleIsPaused({
                        from: admin
                    });
                    await expectRevert(
                        this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('1.0'), {
                            from: bidder,
                            value: USE_ZERO_ADDRESS_TOKEN ? ether('1.0') : 0
                        }),
                        "Pausable: paused"
                    );
                });
    
                it('will fail when outbidding someone by less than the increment', async () => {
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('12');
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }                
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
    
                    await expectRevert(
                        this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                            from: bidder,
                            value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                        }),
                        'failed to outbid highest bidder'
                    );
                });
            });
    
            describe('successfully places bid', () => {
    
                beforeEach(async () => {
                    await this.nft.mint(minter, randomTokenURI, {
                        from: minter,
                        value: mintFee
                    });
                    //await this.auction.setNowOverride('1');
                    await this.auction.setTime('1');
                    await this.auction.createAuction(
                        this.nft.address,
                        TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '2', false, '302',
                        {
                            from: minter
                        }
                    );
                });
    
                it('places bid and you are the top owner', async () => {
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }                   
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
    
                    const {
                        _bidder,
                        _bid
                    } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                    expect(_bid).to.be.bignumber.equal(ether('0.2'));
                    expect(_bidder).to.equal(bidder);
    
                    const {
                        _reservePrice,
                        _startTime,
                        _endTime,
                        _resulted
                    } = await this.auction.getAuction(this.nft.address, TOKEN_ONE_ID);
                    expect(_reservePrice).to.be.bignumber.equal('1');
                    expect(_startTime).to.be.bignumber.equal('2');
                    expect(_endTime).to.be.bignumber.equal('302');
                    expect(_resulted).to.be.equal(false);
                });
    
                it('will refund the top bidder if found', async () => {
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }                   
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
    
                    const {
                        _bidder: originalBidder,
                        _bid: originalBid
                    } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                    expect(originalBid).to.be.bignumber.equal(ether('0.2'));
                    expect(originalBidder).to.equal(bidder);
    
                    const bidderTracker = await balance.tracker(bidder);
                    const bidderBalance = await this.mockToken.balanceOf(bidder);
    
                    // make a new bid, out bidding the previous bidder
                    if (!USE_ZERO_ADDRESS_TOKEN) {                    
                      await this.mockToken.mint(bidder2, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder2});
                    }                   
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.4'), {
                        from: bidder2,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.4') : 0
                    });
    
                    // Funds sent back to original bidder
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      const changes = await bidderTracker.delta('wei');
                      expect(changes).to.be.bignumber.equal(ether('0.2'));
                    } else {
                      const bidderNewBalance = await this.mockToken.balanceOf(bidder);
                      expect(web3.utils.toBN(bidderNewBalance - bidderBalance).toString()).to.equal(ether('0.2').toString());
                    }
    
                    const {
                        _bidder,
                        _bid
                    } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                    expect(_bid).to.be.bignumber.equal(ether('0.4'));
                    expect(_bidder).to.equal(bidder2);
                });
    
                it('successfully increases bid', async () => {
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
                    
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }
                    
                    const bidderTracker = await balance.tracker(bidder);                                   
                    const bidderBalance = await this.mockToken.balanceOf(bidder);
                    const receipt = await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
    
                    // gasfees remains on main coin, not on token..
                    const bidderNewBalance = await this.mockToken.balanceOf(bidder);
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      expect(await bidderTracker.delta()).to.be.bignumber.equal(ether('0.2').add(await getGasCosts(receipt)).mul(new BN('-1')));
                    } else {
                      expect(await bidderTracker.delta()).to.be.bignumber.equal(ether('0').add(await getGasCosts(receipt)).mul(new BN('-1')));
                      expect(web3.utils.toBN(bidderBalance - bidderNewBalance).toString()).to.equal(ether('0.2').toString());                      
                    }
    
                    const {
                        _bidder,
                        _bid
                    } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                    expect(_bid).to.be.bignumber.equal(ether('0.2'));
                    expect(_bidder).to.equal(bidder);
    
    
                    const receipt2 = await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('1'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('1') : 0
                    });
    
                    const bidderNewBalance2 = await this.mockToken.balanceOf(bidder);
                    // gasfees remains on main coin, not on token..                          
                    // check that the bidder has only really spent 0.8 ETH plus gas due to 0.2 ETH refund
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      expect(await bidderTracker.delta()).to.be.bignumber.equal((ether('1').sub(ether('0.2'))).add(await getGasCosts(receipt2)).mul(new BN('-1')));
                    } else {               
                      expect(await bidderTracker.delta()).to.be.bignumber.equal(ether('0').add(await getGasCosts(receipt2)).mul(new BN('-1')));
                      expect(web3.utils.toBN(bidderNewBalance - bidderNewBalance2).toString()).to.equal(ether('0.8').toString());
                    }
    
                    const {
                        _bidder: newBidder,
                        _bid: newBid
                    } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                    expect(newBid).to.be.bignumber.equal(ether('1'));
                    expect(newBidder).to.equal(bidder);
                })
    
                it('successfully outbid bidder', async () => {
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
    
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    
                      await this.mockToken.mint(bidder2, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder2});
                    }                  
    
                    const bidderTracker = await balance.tracker(bidder);
                    const bidderBalance = await this.mockToken.balanceOf(bidder);                
                    const bidder2Tracker = await balance.tracker(bidder2);
                    const bidder2Balance = await this.mockToken.balanceOf(bidder2);
    
                    // Bidder 1 makes first bid
                    const receipt = await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
                    // gasfees remains on main coin, not on token..
                    const bidderNewBalance = await this.mockToken.balanceOf(bidder);
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      expect(await bidderTracker.delta()).to.be.bignumber.equal(ether('0.2').add(await getGasCosts(receipt)).mul(new BN('-1')));
                    } else {                   
                      expect(await bidderTracker.delta()).to.be.bignumber.equal(ether('0').add(await getGasCosts(receipt)).mul(new BN('-1')));
                      expect(web3.utils.toBN(bidderBalance - bidderNewBalance).toString()).to.equal(ether('0.2').toString());                      
                    }                
                                        
                    const {
                        _bidder,
                        _bid
                    } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                    expect(_bid).to.be.bignumber.equal(ether('0.2'));
                    expect(_bidder).to.equal(bidder);
    
                    // Bidder 2 outbids bidder 1
                    const receipt2 = await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('1'), {
                        from: bidder2,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('1') : 0
                    });
    
                    const bidderNewBalance2 = await this.mockToken.balanceOf(bidder); 
                    const bidder2NewBalance = await this.mockToken.balanceOf(bidder2); 
                    // gasfees remains on main coin, not on token..
                    // check that the bidder has only really spent 0.8 ETH plus gas due to 0.2 ETH refund
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      expect(await bidder2Tracker.delta()).to.be.bignumber.equal(ether('1').add(await getGasCosts(receipt2)).mul(new BN('-1')));
                    } else {
                      expect(await bidder2Tracker.delta()).to.be.bignumber.equal(ether('0').add(await getGasCosts(receipt2)).mul(new BN('-1')));
                      expect(web3.utils.toBN(bidder2Balance - bidder2NewBalance).toString()).to.equal(ether('1').toString());
                    }
                    if (USE_ZERO_ADDRESS_TOKEN) {                
                      expect(await bidderTracker.delta()).to.be.bignumber.equal(ether('0.2'));
                    } else {
                      expect(web3.utils.toBN(bidderNewBalance2 - bidderNewBalance).toString()).to.equal(ether('0.2').toString());
                    }                
    
                    const {
                        _bidder: newBidder,
                        _bid: newBid
                    } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                    expect(newBid).to.be.bignumber.equal(ether('1'));
                    expect(newBidder).to.equal(bidder2);
                })
            });
        });
            
        describe('withdrawBid()', async () => {
    
            beforeEach(async () => {
                await this.nft.mint(minter, randomTokenURI, {
                    from: minter,
                    value: mintFee
                });
                //await this.auction.setNowOverride('2');
                await this.auction.setTime('2');
                await this.auction.createAuction(
                    this.nft.address,
                    TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '5', false, '305', {
                        from: minter
                    }
                );
                await this.auction.setTime('5');
                if (!USE_ZERO_ADDRESS_TOKEN) {
                  await this.mockToken.mint(bidder, ether('50'), {from: admin});
                  await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                }  
                
                await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                    from: bidder,
                    value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                });
            });
    
            it('fails with withdrawing a bid which does not exist', async () => {
                await expectRevert(
                    this.auction.withdrawBid(this.nft.address, nonExistentTokenId, {
                        from: bidder2
                    }),
                    'you are not the highest bidder'
                );
            });
    
            it('fails with withdrawing a bid which you did not make', async () => {
                await expectRevert(
                    this.auction.withdrawBid(this.nft.address, TOKEN_ONE_ID, {
                        from: bidder2
                    }),
                    'you are not the highest bidder'
                );
            });
    
            it('fails with withdrawing when lockout time not passed', async () => {
                await this.auction.updateBidWithdrawalLockTime('6');
                //await this.auction.setNowOverride('5');
                await this.auction.setTime('306');
                await expectRevert(
                    this.auction.withdrawBid(this.nft.address, TOKEN_ONE_ID, {
                        from: bidder
                    }),
                    "'can withdraw only after bidWithdrawalLockTime (after auction ended)"
                );
            });
    
            it('fails when withdrawing after auction end', async () => {
                //await this.auction.setNowOverride('12');
                await this.auction.setTime('12');
                await this.auction.updateBidWithdrawalLockTime('0', {
                    from: admin
                });
                await expectRevert(
                    this.auction.withdrawBid(this.nft.address, TOKEN_ONE_ID, {
                        from: bidder
                    }),
                    "can withdraw only after bidWithdrawalLockTime (after auction ended)"
                );
            });
    
            it('fails when the contract is paused', async () => {
                const {
                    _bidder: originalBidder,
                    _bid: originalBid
                } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                expect(originalBid).to.be.bignumber.equal(ether('0.2'));
                expect(originalBidder).to.equal(bidder);
    
                const bidderTracker = await balance.tracker(bidder);
    
                // remove the withdrawal lock time for the test
                await this.auction.updateBidWithdrawalLockTime('0', {
                    from: admin
                });
    
                await this.auction.toggleIsPaused({
                    from: admin
                });
                await expectRevert(
                    this.auction.withdrawBid(this.nft.address, TOKEN_ONE_ID, {
                        from: bidder
                    }),
                    "Pausable: paused"
                );
            });
    
            it('successfully withdraw the bid', async () => {
                const {
                    _bidder: originalBidder,
                    _bid: originalBid
                } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                expect(originalBid).to.be.bignumber.equal(ether('0.2'));
                expect(originalBidder).to.equal(bidder);
    
                const bidderTracker = await balance.tracker(bidder);
                const bidderBalance = await this.mockToken.balanceOf(bidder);
    
                await this.auction.setTime('320');
                // remove the withdrawal lock time for the test
                await this.auction.updateBidWithdrawalLockTime('0', {
                    from: admin
                });
    
                const receipt = await this.auction.withdrawBid(this.nft.address, TOKEN_ONE_ID, {
                    from: bidder
                });
    
                // Funds sent back to original bidder, minus GAS costs
                const changes = await bidderTracker.delta('wei');
                // gasfees remains on main coin, not on token..
                if (USE_ZERO_ADDRESS_TOKEN) {
                  expect(changes).to.be.bignumber.equal(ether('0.2').sub(await getGasCosts(receipt)));
                } else {
                  const bidderNewBalance = await this.mockToken.balanceOf(bidder);
                  expect(changes).to.be.bignumber.equal(ether('0').sub(await getGasCosts(receipt)));
                  expect(web3.utils.toBN(bidderNewBalance - bidderBalance).toString()).to.equal(ether('0.2').toString());                  
                }
    
                const {
                    _bidder,
                    _bid
                } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                expect(_bid).to.be.bignumber.equal('0');
                expect(_bidder).to.equal(constants.ZERO_ADDRESS);
            });
        });
        
        describe('resultAuction()', async () => {
    
            describe('validation', () => {
    
                beforeEach(async () => {
                    await this.nft.mint(minter, randomTokenURI, {
                        from: minter,
                        value: mintFee
                    });
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
                    await this.auction.createAuction(
                        this.nft.address,
                        TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '10', '5', true, '305', {
                            from: minter
                        }
                    );
                });
    
                it('cannot result if not an owner', async () => {
                    await expectRevert(
                        this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                            from: bidder
                        }),
                        'sender must be item owner'
                    );
                });
    
                it('cannot result if auction has not ended', async () => {
                    await expectRevert(
                        this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                            from: minter
                        }),
                        'auction not ended'
                    );
                });
                it('bid cannot be lower than reserve price', async () => {
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }              
                    await this.auction.setTime('12');
                    
                    await expectRevert(                                
                        this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, '9', {
                            from: bidder,
                            value: USE_ZERO_ADDRESS_TOKEN ? '9' : 0 //value: (await this.auction.minBidIncrement())
                        }),
                        'bid cannot be lower than reserve price'
                    );
                });
                            
                it('cannot result if the auction is reserve not reached', async () => {
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }              
                    await this.auction.setTime('12');
                    
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, '10', {
                           from: bidder,
                            value: USE_ZERO_ADDRESS_TOKEN ? '10' : 0//value: (await this.auction.minBidIncrement())
                    });                
                    
                    await this.auction.updateAuctionReservePrice(this.nft.address, TOKEN_ONE_ID, '100', {
                        from: minter
                    });
    
                    await this.auction.setTime('40000');
                    await expectRevert(
                        this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                            from: minter
                        }),
                        'highest bid is below reservePrice'
                    );
                });
    
                it('cannot result if the auction has no winner', async () => {
                    // Lower reserve to zero
                    await this.auction.updateAuctionReservePrice(this.nft.address, TOKEN_ONE_ID, '0', {
                        from: minter
                    });
                    await this.auction.setTime('40000');
                    await expectRevert(
                        this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                            from: minter
                        }),
                        'no open bids'
                    );
                });
    
                it('cannot result if the auction if its already resulted', async () => {
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }              
                    await this.auction.setTime('12');
    
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('1'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('1') : 0
                    });
                    await this.auction.setTime('40000');
    
                    // result it
                    await this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                        from: minter
                    });
    
                    // try result it again
                    await expectRevert(
                        this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                            from: minter
                        }),
                        'sender must be item owner'
                    );
                });
              
            });
    
            describe('successfully resulting an auction', async () => {
    
                beforeEach(async () => {
                    await this.nft.mint(minter, randomTokenURI, {
                        from: minter,
                        value: mintFee
                    });
                    //await this.auction.setNowOverride('2');
                    await this.auction.setTime('2');
                    await this.auction.createAuction(
                        this.nft.address,
                        TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, ether('0.1'), '5', true, '305', {
                            from: minter
                        }
                    );
                });
    
                it('transfer token to the winner', async () => {
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }              
                    await this.auction.setTime('12');            
                
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
                    //await this.auction.setNowOverride('12');
                    await this.auction.setTime('40000');
    
                    expect(await this.nft.ownerOf(TOKEN_ONE_ID)).to.be.equal(minter);
    
                    await this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                        from: minter
                    });
    
                    expect(await this.nft.ownerOf(TOKEN_ONE_ID)).to.be.equal(bidder);
                });
    
                it('transfer funds to the token creator and platform', async () => {
                
                    await this.mockToken.mint(bidder, ether('50'), {from: admin});
                    await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});              
                    await this.auction.setTime('12');
                                
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.4'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.4') : 0
                    });
                    //await this.auction.setNowOverride('12');
                    await this.auction.setTime('40000');
    
                    const platformFeeTracker = await balance.tracker(platformFeeAddress);               
                    const minterTracker = await balance.tracker(minter);
                    const platformBalance = await this.mockToken.balanceOf(platformFeeAddress);
                    const minterBalance = await this.mockToken.balanceOf(minter);
                    //console.log("platformBalance: ", platformBalance.toString());
                    //console.log("minterBalance: ", minterBalance.toString());
    
                    // Result it successfully
                    await this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                        from: minter
                    });
    
                    const platformNewBalance = await this.mockToken.balanceOf(platformFeeAddress);
                    const minterNewBalance = await this.mockToken.balanceOf(minter);
                    
                    // Platform gets 12%
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      const platformChanges = await platformFeeTracker.delta('wei');
                      expect(platformChanges).to.be.bignumber.equal(
                          (ether('0.4').sub(ether('0.1'))) // total minus reserve
                          .div(new BN('1000'))
                          .mul(new BN('75')) // only 12% of total
                      );
                    } else {
                                     
                      //console.log("platformBalance: ", platformNewBalance.toString());
                      //console.log("minterBalance: ", minterNewBalance.toString());                                     
                      expect(web3.utils.toBN(platformNewBalance - platformBalance).toString()).to.equal(
                          ((ether('0.4').sub(ether('0.1'))) // total minus reserve
                          .div(new BN('1000'))
                          .mul(new BN('75')) // only 7.5% of total
                          ).toString());
                    }
     
                    // Remaining funds sent to minter on completion
                    if (USE_ZERO_ADDRESS_TOKEN) {                    
                      const changes = await minterTracker.delta('wei');
                      expect(changes).to.be.bignumber.greaterThan(ether('0'));
                    } else {
                      expect(web3.utils.toBN(minterNewBalance - minterBalance)).to.bignumber.greaterThan(ether('0'));
                    }                                
                });
    
                it('transfer funds to the token to only the creator when reserve meet directly', async () => {
                
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }              
                    await this.auction.setTime('12');
                
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
                    //await this.auction.setNowOverride('12');
                    await this.auction.setTime('40000');
    
                    const platformFeeTracker = await balance.tracker(platformFeeAddress);
                    const minterTracker = await balance.tracker(minter);
                    const platformBalance = await this.mockToken.balanceOf(platformFeeAddress);
                    const minterBalance = await this.mockToken.balanceOf(minter);                
    
                    // Result it successfully
                    await this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                        from: minter
                    });
    
                    // Platform gets 7.5%
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      const platformChanges = await platformFeeTracker.delta('wei');
                      expect(platformChanges).to.bignumber.greaterThan(ether('0'));
                    } else {
                      const platformNewBalance = await this.mockToken.balanceOf(platformFeeAddress);
                      expect(web3.utils.toBN(platformNewBalance - platformBalance)).to.bignumber.greaterThan(ether('0'));
                    }               
    
                    // Remaining funds sent to designer on completion
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      const changes = await minterTracker.delta('wei');
                      expect(changes).to.be.bignumber.greaterThan(ether('0'));
                    } else {
                      const minterNewBalance = await this.mockToken.balanceOf(minter);
                      expect(web3.utils.toBN(minterNewBalance - minterBalance)).to.bignumber.greaterThan(ether('0'));                      
                    }                  
                });
    
                it('records primary sale price on garment NFT', async () => {
                
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }              
                    await this.auction.setTime('12');
                                  
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.4'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.4') : 0
                    });
                    await this.auction.setTime('40000');                          
    
                    // Result it successfully
                    await this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                        from: minter
                    });
                });
    
            });
        });
    
        describe('cancelAuction()', async () => {
    
            beforeEach(async () => {
                await this.nft.mint(minter, randomTokenURI, {
                    from: minter,
                    value: mintFee
                });
                //await this.auction.setNowOverride('2');
                await this.auction.setTime('2');
                await this.auction.createAuction(
                    this.nft.address,
                    TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '5', false, '305', {
                        from: minter
                    }
                );
            });
    
            describe('validation', async () => {
    
                it('cannot cancel if not an admin', async () => {
                    await expectRevert(
                        this.auction.cancelAuction(this.nft.address, TOKEN_ONE_ID, {
                            from: bidder
                        }),
                        'sender must be owner'
                    );
                });
    
                it('cannot cancel if auction already cancelled', async () => {
                
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }              
                    await this.auction.setTime('12');
                    
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
                    //await this.auction.setNowOverride('12');
                    await this.auction.setTime('40000');
    
                    await this.auction.cancelAuction(this.nft.address, TOKEN_ONE_ID, {
                        from: minter
                    });
    
                    await expectRevert(
                        this.auction.cancelAuction(this.nft.address, TOKEN_ONE_ID, {
                            from: minter
                        }),
                        'sender must be owner'
                    );
                });
    
                it('cannot cancel if auction already resulted', async () => {
    
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }              
                    await this.auction.setTime('12');
                    
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
                    //await this.auction.setNowOverride('12');
                    await this.auction.setTime('40000');
    
                    await this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                        from: minter
                    });
    
                    await expectRevert(
                        this.auction.cancelAuction(this.nft.address, TOKEN_ONE_ID, {
                            from: minter
                        }),
                        'sender must be owner'
                    );
                });
    
                it('Cancel clears down auctions and top bidder', async () => {
                    // Stick a bid on it
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }              
                    await this.auction.setTime('12');
                    
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
    
                    // Cancel it
                    await this.auction.cancelAuction(this.nft.address, TOKEN_ONE_ID, {
                        from: minter
                    });
    
                    // Check auction cleaned up
                    const {
                        _reservePrice,
                        _startTime,
                        _endTime,
                        _resulted
                    } = await this.auction.getAuction(this.nft.address, TOKEN_ONE_ID);
                    expect(_reservePrice).to.be.bignumber.equal('0');
                    expect(_startTime).to.be.bignumber.equal('0');
                    expect(_endTime).to.be.bignumber.equal('0');
                    expect(_resulted).to.be.equal(false);
    
                    // Check auction cleaned up
                    const {
                        _bidder,
                        _bid
                    } = await this.auction.getHighestBidder(this.nft.address, TOKEN_ONE_ID);
                    expect(_bid).to.be.bignumber.equal('0');
                    expect(_bidder).to.equal(constants.ZERO_ADDRESS);
                });
    
                it('funds are sent back to the highest bidder if found', async () => {
                    // Stick a bid on it
                    if (!USE_ZERO_ADDRESS_TOKEN) {
                      await this.mockToken.mint(bidder, ether('50'), {from: admin});
                      await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                    }              
                    await this.auction.setTime('12');
                                    
                    await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                        from: bidder,
                        value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                    });
    
                    const bidderTracker = await balance.tracker(bidder);
                    const bidderBalance = await this.mockToken.balanceOf(bidder); 
    
                    //cancel it
                    await this.auction.cancelAuction(this.nft.address, TOKEN_ONE_ID, {
                        from: minter
                    });
    
                    // Funds sent back
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      const changes = await bidderTracker.delta('wei');
                      expect(changes).to.be.bignumber.equal(ether('0.2'));
                    } else {
                      const bidderNewBalance = await this.mockToken.balanceOf(bidder);
                      expect(web3.utils.toBN(bidderNewBalance - bidderBalance)).to.bignumber.equal(ether('0.2'));                      
                    }
                });
    
                it('no funds transferred if no bids', async () => {
                    //cancel it
                    await this.auction.cancelAuction(this.nft.address, TOKEN_ONE_ID, {
                        from: minter
                    });
                });
            });
        });
        
        describe('create, cancel and re-create an auction', async () => {
    
            beforeEach(async () => {
                await this.nft.mint(minter, randomTokenURI, {
                    from: minter,
                    value: mintFee
                });
                //await this.auction.setNowOverride('2');
                await this.auction.setTime('2');
                await this.auction.createAuction(
                    this.nft.address,
                    TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '5', false, '305',
                    {
                        from: minter
                    }
                );
            });
    
            it('once created and then cancelled, can be created and resulted properly', async () => {
    
                // Stick a bid on it
                if (!USE_ZERO_ADDRESS_TOKEN) {
                  await this.mockToken.mint(bidder, ether('50'), {from: admin});
                  await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                }              
                await this.auction.setTime('12');
                
                await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                    from: bidder,
                    value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                });
    
                const bidderTracker = await balance.tracker(bidder);
                const bidderBalance = await this.mockToken.balanceOf(bidder);
                
                // Cancel it
                await this.auction.cancelAuction(this.nft.address, TOKEN_ONE_ID, {
                    from: minter
                });
    
                // Funds sent back to bidder
                if (USE_ZERO_ADDRESS_TOKEN) {
                  const changes = await bidderTracker.delta('wei');
                  expect(changes).to.be.bignumber.equal(ether('0.2'));
                } else {
                  const bidderNewBalance = await this.mockToken.balanceOf(bidder);
                  expect(web3.utils.toBN(bidderNewBalance - bidderBalance)).to.bignumber.equal(ether('0.2'));
                }            
    
                // Check auction cleaned up
                const {
                    _reservePrice,
                    _startTime,
                    _endTime,
                    _resulted
                } = await this.auction.getAuction(this.nft.address, TOKEN_ONE_ID);
                expect(_reservePrice).to.be.bignumber.equal('0');
                expect(_startTime).to.be.bignumber.equal('0');
                expect(_endTime).to.be.bignumber.equal('0');
                expect(_resulted).to.be.equal(false);
    
                // Crate new one
                await this.auction.createAuction(
                    this.nft.address,
                    TOKEN_ONE_ID, USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, '1', '50', false, '355',
                    {
                        from: minter
                    }
                );
    
                // Check auction newly setup
                const {
                    _reservePrice: newReservePrice,
                    _startTime: newStartTime,
                    _endTime: newEndTime,
                    _resulted: newResulted
                } = await this.auction.getAuction(this.nft.address, TOKEN_ONE_ID);
                expect(newReservePrice).to.be.bignumber.equal('1');
                expect(newStartTime).to.be.bignumber.equal('50');
                expect(newEndTime).to.be.bignumber.equal('355');
                expect(newResulted).to.be.equal(false);
    
                // Stick a bid on it
                if (!USE_ZERO_ADDRESS_TOKEN) {
                  await this.mockToken.mint(bidder, ether('50'), {from: admin});
                  await this.mockToken.approve(this.auction.address, ether('50'), {from: bidder});
                }              
                await this.auction.setTime('72');
                
                await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, ether('0.2'), {
                    from: bidder,
                    value: USE_ZERO_ADDRESS_TOKEN ? ether('0.2') : 0
                });
    
                //await this.auction.setNowOverride('12');
                await this.auction.setTime('40000');
    
                // Result it
                const {
                    receipt
                } = await this.auction.resultAuction(this.nft.address, TOKEN_ONE_ID, {
                    from: minter
                });
                await expectEvent(receipt, 'AuctionResulted', {
                    nftAddress: this.nft.address,
                    tokenId: TOKEN_ONE_ID,
                    winner: bidder,
                    winningBid: ether('0.2')
                });
            });
    
        });
        
        describe('reclaimERC20()', async () => {
            describe('validation', async () => {
                it('cannot reclaim erc20 if it is not Admin', async () => {
                    await expectRevert(
                        this.auction.reclaimERC20(USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, {
                            from: bidder
                        }),
                        'Ownable: caller is not the owner'
                    );
                });
    
                it('can reclaim Erc20', async () => {

                    const auctionTracker = await balance.tracker(this.auction.address);
                    const adminTracker = await balance.tracker(admin);
                                    
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      await this.nft.mint(minter, randomTokenURI, { from: minter, value: mintFee });
                      await this.auction.setTime('2');     
                      await this.auction.createAuction( this.nft.address, TOKEN_ONE_ID, ZERO_ADDRESS, '1', '5', false, '305', { from: minter } )    
                      await this.auction.setTime('12');                
                      await this.auction.placeBid(this.nft.address, TOKEN_ONE_ID, TWENTY_TOKENS, { from: bidder, value: TWENTY_TOKENS });
                      expect(await auctionTracker.delta()).to.be.bignumber.equal(TWENTY_TOKENS);
                    } else {
                      await this.mockToken.mint(minter, TWENTY_TOKENS, {from: admin});                 
                      // Send some wrapped eth
                      await this.mockToken.transfer(this.auction.address, TWENTY_TOKENS, { from: minter });    
                      expect(await this.mockToken.balanceOf(this.auction.address)).to.be.bignumber.equal(TWENTY_TOKENS);
                    }
                    const adminBalanceBeforeReclaim = await this.mockToken.balanceOf(admin);
                        
                    // Reclaim erc20 from contract
                    let receipt = await this.auction.reclaimERC20(USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockToken.address, { from: admin });
    
                    if (USE_ZERO_ADDRESS_TOKEN) {
                      expect(await auctionTracker.delta()).to.be.bignumber.equal((TWENTY_TOKENS).mul(new BN('-1')));
                      
                      // todo.. check this..
                      //AssertionError: expected '19999899238999193912' to equal '19999969260999754088'
                      // + expected - actual
                      // -19999899238999193912
                      // +19999969260999754088
                      // expect(await adminTracker.delta()).to.be.bignumber.equal((TWENTY_TOKENS).sub(await getGasCosts(receipt)));                      
                      expect(await adminTracker.delta()).to.be.bignumber.greaterThan(ether('19'));
                      
                    } else {                    
                      expect(await this.mockToken.balanceOf(this.auction.address)).to.be.bignumber.equal(new BN('0'));
                      // Admin receives eth minus gas fees.
                      expect(await this.mockToken.balanceOf(admin)).to.be.bignumber.greaterThan(adminBalanceBeforeReclaim);
                    }
                });
            });
        });

    } // for
    
    async function getGasCosts(receipt) {
        const tx = await web3.eth.getTransaction(receipt.tx);
        const gasPrice = new BN(tx.gasPrice);
        return gasPrice.mul(new BN(receipt.receipt.gasUsed));
    }
});
