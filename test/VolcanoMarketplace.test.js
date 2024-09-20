// npx hardhat test ./test/VolcanoMarketplace.test.js --network localhost
const {
    BN,
    ether,
    constants,
    expectEvent,
    expectRevert,
    balance,
} = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;

const {
    expect
} = require('chai');

const VolcanoAddressRegistry = artifacts.require('VolcanoAddressRegistry');
const VolcanoCom = artifacts.require('MockVolcanoERC721Tradable');
const VolcanoMarketplace = artifacts.require('VolcanoMarketplace');
const VolcanoBundleMarketplace = artifacts.require('VolcanoBundleMarketplace');
const MockERC20 = artifacts.require('MockERC20');
const VolcanoTokenRegistry = artifacts.require('VolcanoTokenRegistry');
const VolcanoPriceFeed = artifacts.require('VolcanoPriceFeed');

const weiToEther = (n) => {
    return web3.utils.fromWei(n.toString(), 'ether');
}

contract('Core ERC721 tests for VolcanoCom', function([
    owner,
    minter,
    buyer,
    feeRecipient,
]) {
    const firstTokenId = new BN('1');
    const secondTokenId = new BN('2');
    const nonExistentTokenId = new BN('99');
    const mintFee = new BN('5'); // mintFee
    const platformFee = web3.utils.toWei('250', 'wei'); // marketplace platform fee: 2.5%
    const pricePerItem = new BN('1000000000000000000');
    const newPrice = new BN('500000000000000000');

    const RECEIVER_MAGIC_VALUE = '0x150b7a02';

    const randomTokenURI = 'ipfs';

    beforeEach(async function() {
        //console.log(`beforeEach called`);
        this.nft = await VolcanoCom.new(owner, ether(mintFee));
        let firstTokenresult = await this.nft.mint(minter, randomTokenURI, {
            from: owner,
            value: ether(mintFee)
        });
        let secondTokenresult = await this.nft.mint(owner, randomTokenURI, {
            from: owner,
            value: ether(mintFee)
        });
                
        this.volcanoAddressRegistry = await VolcanoAddressRegistry.new({ from: owner });
        this.volcanoTokenRegistry = await VolcanoTokenRegistry.new({ from: owner });
        this.mockERC20 = await MockERC20.new("wFTM", "wFTM", ether('1000000'), { from: owner });
        this.volcanoTokenRegistry.add(this.mockERC20.address, { from: owner });
                        
        //this.marketplace = await VolcanoMarketplace.new({ from: owner });
        //await this.marketplace.initialize(feeRecipient, platformFee, { from: owner });
        //await this.marketplace.updateAddressRegistry(this.volcanoAddressRegistry.address, { from: owner });       
                        
        //this.volcanoBundleMarketplace = await VolcanoBundleMarketplace.new({ from: owner });
        //await this.volcanoBundleMarketplace.initialize(feeRecipient, platformFee, { from: owner });
        //await this.volcanoBundleMarketplace.updateAddressRegistry(this.volcanoAddressRegistry.address, { from: owner });
        
        const Marketplace = await ethers.getContractFactory('VolcanoMarketplace');
        this.volcanoMarketplaceEthers = await upgrades.deployProxy(Marketplace, [feeRecipient, platformFee], { from: owner,  initializer: 'initialize', kind: 'uups' });
        await this.volcanoMarketplaceEthers.waitForDeployment();
        this.volcanoMarketplaceEthers.address = await this.volcanoMarketplaceEthers.getAddress(); 
        this.marketplace = await VolcanoMarketplace.at(this.volcanoMarketplaceEthers.address);      
        await this.marketplace.updateAddressRegistry(this.volcanoAddressRegistry.address, { from: owner });        
                    
        const BundleMarketplace = await ethers.getContractFactory('VolcanoBundleMarketplace');
        this.volcanoBundleMarketplaceEthers = await upgrades.deployProxy(BundleMarketplace, [feeRecipient, platformFee], {from: owner, initializer: 'initialize', kind: 'uups' });
        await this.volcanoBundleMarketplaceEthers.waitForDeployment();  
        this.volcanoBundleMarketplaceEthers.address = await this.volcanoBundleMarketplaceEthers.getAddress();  
        this.volcanoBundleMarketplace = await VolcanoBundleMarketplace.at(this.volcanoBundleMarketplaceEthers.address);
        await this.volcanoBundleMarketplace.updateAddressRegistry(this.volcanoAddressRegistry.address, { from: owner });
                
        
        this.volcanoPriceFeed = await VolcanoPriceFeed.new(this.volcanoAddressRegistry.address, this.mockERC20.address, { from: owner });
                 
        await this.volcanoAddressRegistry.updateMarketplace(this.marketplace.address, { from: owner });
        await this.volcanoAddressRegistry.updateTokenRegistry(this.volcanoTokenRegistry.address, { from: owner });
        await this.volcanoAddressRegistry.updateBundleMarketplace(this.volcanoBundleMarketplace.address, { from: owner });
        await this.volcanoAddressRegistry.updatePriceFeed(this.volcanoPriceFeed.address, { from: owner });
    });
    
    for (t = 0; t <= 1; t = t+1) {
        
        let USE_ZERO_ADDRESS_TOKEN = (t == 0);
    
        describe('Listing Item', function() {
            this.beforeEach(async function() {
                it('reverts when not owning NFT', async function() {
                    await expectRevert(
                        this.marketplace.listItem(
                            this.nft.address,
                            firstTokenId,
                            '1',
                            USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                            pricePerItem,
                            '0', {
                                from: owner
                            }
                        ),
                        "not owning item"
                    );
                });
            });
    
            it('reverts when not approved', async function() {
                await expectRevert(
                    this.marketplace.listItem(
                        this.nft.address,
                        firstTokenId,
                        '1',
                        USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                        pricePerItem,
                        '0', {
                            from: minter
                        }
                    ),
                    "item not approved"
                );
            });
    
            it('successfuly lists item', async function() {
                await this.nft.setApprovalForAll(this.marketplace.address, true, {
                    from: minter
                });
                await this.marketplace.listItem(
                    this.nft.address,
                    firstTokenId,
                    '1',
                    USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                    pricePerItem,
                    '0', {
                        from: minter
                    }
                );
            })
    
        });
    
        describe('Canceling Item', function() {
            this.beforeEach(async function() {
                await this.nft.setApprovalForAll(this.marketplace.address, true, {
                    from: minter
                });
                await this.marketplace.listItem(
                    this.nft.address,
                    firstTokenId,
                    '1',
                    USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                    pricePerItem,
                    '0', {
                        from: minter
                    }
                );
            });
    
            it('reverts when item is not listed', async function() {
                await expectRevert(
                    this.marketplace.cancelListing(
                        this.nft.address,
                        secondTokenId, {
                            from: owner
                        }
                    ),
                    "not listed item"
                );
            });
    
            it('reverts when not owning the item', async function() {
                await expectRevert(
                    this.marketplace.cancelListing(
                        this.nft.address,
                        firstTokenId, {
                            from: owner
                        }
                    ),
                    "not listed item"
                );
            });
    
            it('successfully cancel the item', async function() {
                await this.marketplace.cancelListing(
                    this.nft.address,
                    firstTokenId, {
                        from: minter
                    }
                );
            })
        });
    
    
        describe('Updating Item Price', function() {
            this.beforeEach(async function() {
                await this.nft.setApprovalForAll(this.marketplace.address, true, {
                    from: minter
                });
                await this.marketplace.listItem(
                    this.nft.address,
                    firstTokenId,
                    '1',
                    USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                    pricePerItem,
                    '0', {
                        from: minter
                    }
                );
            });
    
            it('reverts when item is not listed', async function() {
                await expectRevert(
                    this.marketplace.updateListing(
                        this.nft.address,
                        secondTokenId,
                        USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                        newPrice, {
                            from: owner
                        }
                    ),
                    "not listed item"
                );
            });
    
            it('reverts when not owning the item', async function() {
                await expectRevert(
                    this.marketplace.updateListing(
                        this.nft.address,
                        firstTokenId,
                        USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                        newPrice, {
                            from: owner
                        }
                    ),
                    "not listed item"
                );
            });
    
            it('successfully update the item', async function() {
                await this.marketplace.updateListing(
                    this.nft.address,
                    firstTokenId,
                    USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                    newPrice, {
                        from: minter
                    }
                );
            })
        });
    
        describe('Buying Item', function() {
            beforeEach(async function() {
                await this.nft.setApprovalForAll(this.marketplace.address, true, {
                    from: minter
                });
                await this.marketplace.listItem(
                    this.nft.address,
                    firstTokenId,
                    '1',
                    USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                    pricePerItem,
                    '0', {
                        from: minter
                    }
                );
            });
    
            it('reverts when seller doesnt own the item', async function() {
                await this.nft.safeTransferFrom(minter, owner, firstTokenId, {
                    from: minter
                });
                await expectRevert(
                    this.marketplace.buyItem(
                        this.nft.address,
                        firstTokenId,
                        USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                        minter, {
                            from: buyer,
                            value: USE_ZERO_ADDRESS_TOKEN ? pricePerItem : 0
                        }
                    ),
                    "not owning item"
                );
            });
    
            it('reverts when buying before the scheduled time', async function() {
            
                await this.nft.safeTransferFrom(owner, minter, secondTokenId, {
                    from: owner
                });
                        
                await this.nft.setApprovalForAll(this.marketplace.address, true, {
                    from: owner
                });
                await this.marketplace.listItem(
                    this.nft.address,
                    secondTokenId,
                    '1',
                    USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address, 
                    pricePerItem,
                    constants.MAX_UINT256, // scheduling for a future sale
                    {
                        from: minter
                    }
                );
                await expectRevert(
                    this.marketplace.buyItem(
                        this.nft.address,
                        secondTokenId,
                        USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address, 
                        owner, {
                            from: buyer,
                            value: USE_ZERO_ADDRESS_TOKEN ? pricePerItem : 0
                        }
                    ),
                    //"item not buyable"
                    "not listed item"
                );
            });
    
            //if (!USE_ZERO_ADDRESS_TOKEN) {
              it('reverts when the amount is not enough', async function() {
                  await expectRevert(
                      this.marketplace.buyItem(
                          this.nft.address,
                          firstTokenId,
                          USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,
                          minter, {
                              from: buyer,
                              value: 0 // USE_ZERO_ADDRESS_TOKEN ? pricePerItem : 0
                          }
                      ),
                      USE_ZERO_ADDRESS_TOKEN ? "insufficient or incorrect value to buy" : "ERC20: insufficient allowance"
                  );
              });
            //}
    
            it('successfully purchase item', async function() {
                
                const feeBalanceTracker = await balance.tracker(feeRecipient);//('0xFC00FACE00000000000000000000000000000000', 'ether');
                const minterBalanceTracker = await balance.tracker(minter);
                const buyerBalanceTracker = await balance.tracker(buyer);
                
                if (!USE_ZERO_ADDRESS_TOKEN) {
                  await this.mockERC20.mint(buyer, ether('50'));
                  await this.mockERC20.approve(this.marketplace.address, ether('50'), {from: buyer});
                }
                const feeBalance = await this.mockERC20.balanceOf(feeRecipient);//('0xFC00FACE00000000000000000000000000000000');
                const minterBalance = await this.mockERC20.balanceOf(minter);
                          
                const receipt = await this.marketplace.buyItem(
                    this.nft.address,
                    firstTokenId,
                    USE_ZERO_ADDRESS_TOKEN ? ZERO_ADDRESS : this.mockERC20.address,                 
                    minter, {
                        from: buyer,
                        value: USE_ZERO_ADDRESS_TOKEN ? pricePerItem : 0
                    }
                );
                expect(await this.nft.ownerOf(firstTokenId)).to.be.equal(buyer);
                
                const cost = await getGasCosts(receipt);
                console.log("Computed gas costs (ether): ", weiToEther(cost)*1);                
                
                if (USE_ZERO_ADDRESS_TOKEN) {
                  expect(await feeBalanceTracker.delta()).to.be.bignumber.equal(ether('0.025'));
                  expect(await minterBalanceTracker.delta()).to.be.bignumber.equal(ether('0.975'));
                  expect(await buyerBalanceTracker.delta()).to.be.bignumber.equal(new BN(pricePerItem).add(cost).mul(new BN('-1')));
                } else {
                  const newfeeBalance = await this.mockERC20.balanceOf(feeRecipient);//('0xFC00FACE00000000000000000000000000000000');
                  const newminterBalance = await this.mockERC20.balanceOf(minter); 
                  const buyerBalance = await this.mockERC20.balanceOf(buyer);            
                  expect(weiToEther(newfeeBalance)*1 - weiToEther(feeBalance)*1).to.be.equal(0.025);
                  expect(weiToEther(newminterBalance)*1 - weiToEther(minterBalance)*1).to.be.equal(0.975);
                  expect(weiToEther(buyerBalance)*1).to.be.equal(49); // 50 - pricePerItem
                }                 
            })
        })
    } // for

    async function getGasCosts(receipt) {
        const tx = await web3.eth.getTransaction(receipt.tx);
        const gasPrice = new BN(tx.gasPrice);
        return gasPrice.mul(new BN(receipt.receipt.gasUsed));
    }
})
