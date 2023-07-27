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

const PricyAddressRegistry = artifacts.require('PricyAddressRegistry');
const PricyCom = artifacts.require('PricyCom');
const PricyMarketplace = artifacts.require('PricyMarketplace');
const PricyBundleMarketplace = artifacts.require('PricyBundleMarketplace');
const MockERC20 = artifacts.require('MockERC20');
const PricyTokenRegistry = artifacts.require('PricyTokenRegistry');
const PricyPriceFeed = artifacts.require('PricyPriceFeed');

const weiToEther = (n) => {
    return web3.utils.fromWei(n.toString(), 'ether');
}

contract('Core ERC721 tests for PricyCom', function([
    owner,
    minter,
    buyer,
    feeRecipient,
]) {
    const firstTokenId = new BN('1');
    const secondTokenId = new BN('2');
    const nonExistentTokenId = new BN('99');
    const mintFee = new BN('5'); // mintFee
    const platformFee = new BN('25'); // marketplace platform fee: 2.5%
    const pricePerItem = new BN('1000000000000000000');
    const newPrice = new BN('500000000000000000');

    const RECEIVER_MAGIC_VALUE = '0x150b7a02';

    const randomTokenURI = 'ipfs';

    beforeEach(async function() {
        console.log(`beforeEach called`);
        this.nft = await PricyCom.new(owner, mintFee);
        let firstTokenresult = await this.nft.mint(minter, randomTokenURI, {
            from: owner,
            value: ether(mintFee)
        });
        let secondTokenresult = await this.nft.mint(owner, randomTokenURI, {
            from: owner,
            value: ether(mintFee)
        });
                
        this.pricyAddressRegistry = await PricyAddressRegistry.new({ from: owner });
        this.pricyTokenRegistry = await PricyTokenRegistry.new({ from: owner });
        this.mockERC20 = await MockERC20.new("wFTM", "wFTM", ether('1000000'), { from: owner });
        this.pricyTokenRegistry.add(this.mockERC20.address, { from: owner });
                        
        this.marketplace = await PricyMarketplace.new({ from: owner });
        await this.marketplace.initialize(feeRecipient, platformFee, { from: owner });
        await this.marketplace.updateAddressRegistry(this.pricyAddressRegistry.address, { from: owner });       
                        
        this.pricyBundleMarketplace = await PricyBundleMarketplace.new({ from: owner });
        await this.pricyBundleMarketplace.initialize(feeRecipient, platformFee, { from: owner });
        await this.pricyBundleMarketplace.updateAddressRegistry(this.pricyAddressRegistry.address, { from: owner });
        
        this.pricyPriceFeed = await PricyPriceFeed.new(this.pricyAddressRegistry.address, this.mockERC20.address, { from: owner });
                 
        await this.pricyAddressRegistry.updateMarketplace(this.marketplace.address, { from: owner });
        await this.pricyAddressRegistry.updateTokenRegistry(this.pricyTokenRegistry.address, { from: owner });
        await this.pricyAddressRegistry.updateBundleMarketplace(this.pricyBundleMarketplace.address, { from: owner });
        await this.pricyAddressRegistry.updatePriceFeed(this.pricyPriceFeed.address, { from: owner });
    });

    describe('Listing Item', function() {
        this.beforeEach(async function() {
            it('reverts when not owning NFT', async function() {
                await expectRevert(
                    this.marketplace.listItem(
                        this.nft.address,
                        firstTokenId,
                        '1',
                        this.mockERC20.address,
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
                    this.mockERC20.address,
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
                this.mockERC20.address,
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
                this.mockERC20.address,
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
                this.mockERC20.address,
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
                    this.mockERC20.address,
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
                    this.mockERC20.address,
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
                this.mockERC20.address,
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
                // ZERO_ADDRESS means ETH (no token) ?
                // ZERO_ADDRESS, native token payments seems to be no more supported..
                this.mockERC20.address,
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
                    // ZERO_ADDRESS means ETH (no token) ?
                    // ZERO_ADDRESS, native token payments seems to be no more supported..
                    this.mockERC20.address,
                    minter, {
                        from: buyer,
                        //value: pricePerItem
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
                // ZERO_ADDRESS means ETH (no token) ?
                // ZERO_ADDRESS, native token payments seems to be no more supported..
                this.mockERC20.address, 
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
                    // ZERO_ADDRESS means ETH (no token) ?
                    // ZERO_ADDRESS, native token payments seems to be no more supported..
                    this.mockERC20.address, 
                    owner, {
                        from: buyer,
                        //value: pricePerItem
                    }
                ),
                //"item not buyable"
                "not listed item"
            );
        });

        it('reverts when the amount is not enough', async function() {
            await expectRevert(
                this.marketplace.buyItem(
                    this.nft.address,
                    firstTokenId,
                    // ZERO_ADDRESS means ETH (no token) ?
                    // ZERO_ADDRESS, native token payments seems to be no more supported..
                    this.mockERC20.address,
                    minter, {
                        from: buyer
                    }
                ),
                "ERC20: transfer amount exceeds balance"
            );
        });

        it('successfully purchase item', async function() {
            // native token payments seems to be no more supported..
            //const feeBalanceTracker = await balance.tracker('0xFC00FACE00000000000000000000000000000000', 'ether');
            //const minterBalanceTracker = await balance.tracker(minter, 'ether');
            await this.mockERC20.mint(buyer, ether('50'));
            await this.mockERC20.approve(this.marketplace.address, ether('50'), {from: buyer});
            //const buyerBalance = await this.mockERC20.balanceOf(buyer);
            const feeBalance = await this.mockERC20.balanceOf(feeRecipient);//('0xFC00FACE00000000000000000000000000000000');
            const minterBalance = await this.mockERC20.balanceOf(minter);
            //console.log("buyerBalance: ", buyerBalance);
            //console.log("feeBalance: ", feeBalance);
            //console.log("minterBalance: ", minterBalance);
                      
            const receipt = await this.marketplace.buyItem(
                this.nft.address,
                firstTokenId,
                // ZERO_ADDRESS means ETH (no token) ?
                // ZERO_ADDRESS, native token payments seems to be no more supported..
                this.mockERC20.address,                 
                minter, {
                    from: buyer,
                    //value: pricePerItem
                }
            );
            console.log("computing gas costs");
            const cost = await getGasCosts(receipt);
            console.log("Ether: ", weiToEther(cost)*1);
            expect(await this.nft.ownerOf(firstTokenId)).to.be.equal(buyer);
            //expect(await feeBalanceTracker.delta('ether')).to.be.bignumber.equal('0.025');
            //expect(await minterBalanceTracker.delta('ether')).to.be.bignumber.equal('0.975');
            const newfeeBalance = await this.mockERC20.balanceOf(feeRecipient);//('0xFC00FACE00000000000000000000000000000000');
            const newminterBalance = await this.mockERC20.balanceOf(minter); 
            const buyerBalance = await this.mockERC20.balanceOf(buyer);            
            //console.log("newfeeBalance: ", newfeeBalance, " - delta: ", newfeeBalance - feeBalance);
            //console.log("newminterBalance: ", newminterBalance, " - delta: ", minterBalance - newminterBalance);
            //expect(await feeBalanceTracker.delta('ether')).to.be.bignumber.equal('0.025');
            //expect(await minterBalanceTracker.delta('ether')).to.be.bignumber.equal('0.975');  
            expect(weiToEther(newfeeBalance)*1 - weiToEther(feeBalance)*1).to.be.equal(0.025);
            expect(weiToEther(newminterBalance)*1 - weiToEther(minterBalance)*1).to.be.equal(0.975);
            expect(weiToEther(buyerBalance)*1).to.be.equal(49); // 50 - pricePerItem                 
        })
    })

    async function getGasCosts(receipt) {
        const tx = await web3.eth.getTransaction(receipt.tx);
        const gasPrice = new BN(tx.gasPrice);
        return gasPrice.mul(new BN(receipt.receipt.gasUsed));
    }
})