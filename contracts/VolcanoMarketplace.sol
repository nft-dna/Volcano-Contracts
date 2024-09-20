// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

//import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
//import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

interface IVolcanoAddressRegistry {
    //function artion() external view returns (address);

    function bundleMarketplace() external view returns (address);

    function auction() external view returns (address);

    function erc721factory() external view returns (address);

    //function privateErc721Factory() external view returns (address);

    function erc1155Factory() external view returns (address);

    //function privateErc1155Factory() external view returns (address);

    function tokenRegistry() external view returns (address);

    function priceFeed() external view returns (address);
}

interface IVolcanoAuction {
    function auctions(address, uint256)
        external
        view
        returns (
            address,
            address,
            uint256,
            uint256,
            uint256,
            bool
        );
}

interface IVolcanoBundleMarketplace {
    function validateItemSold(
        address,
        uint256,
        uint256
    ) external;
}

interface IVolcanoNFTFactory {
    function exists(address) external view returns (bool);
}

interface IVolcanoTokenRegistry {
    function enabled(address) external view returns (bool);
}

interface IVolcanoPriceFeed {
    function wFTM() external view returns (address);

    function getPrice(address) external view returns (int256, uint8);
}

contract VolcanoMarketplace is Initializable, PausableUpgradeable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {

    using AddressUpgradeable for address payable;
    using SafeERC20 for IERC20;

    /// @notice Events for the contract
    event ItemListed(
        address indexed owner,
        address indexed nft,
        uint256 tokenId,
        uint256 quantity,
        address payToken,
        uint256 pricePerItem,
        uint256 startingTime
    );
    event ItemSold(
        address indexed seller,
        address indexed buyer,
        address indexed nft,
        uint256 tokenId,
        uint256 quantity,
        address payToken,
        int256 payTokenPrice,
        uint256 pricePerItem
    );
    event ItemUpdated(
        address indexed owner,
        address indexed nft,
        uint256 tokenId,
        address payToken,
        uint256 newPrice
    );
    event ItemCanceled(
        address indexed owner,
        address indexed nft,
        uint256 tokenId
    );
    event OfferCreated(
        address indexed creator,
        address indexed nft,
        uint256 tokenId,
        uint256 quantity,
        address payToken,
        uint256 pricePerItem,
        uint256 deadline
    );
    event OfferCanceled(
        address indexed creator,
        address indexed nft,
        uint256 tokenId
    );
    event UpdatePlatformFee(uint16 platformFee);
    event UpdatePlatformFeeRecipient(address payable platformFeeRecipient);

    /// @notice Structure for listed items
    struct Listing {
        uint256 quantity;
        address payToken;
        uint256 pricePerItem;
        uint256 startingTime;
    }

    /// @notice Structure for offer
    struct Offer {
        IERC20 payToken;
        uint256 quantity;
        uint256 pricePerItem;
        uint256 deadline;
    }

    struct CollectionRoyalty {
        uint16 royalty;
        address creator;
        address feeRecipient;
    }

    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant INTERFACE_ID_ERC1155 = 0xd9b67a26;

    /// @notice NftAddress -> Token ID -> Minter
    mapping(address => mapping(uint256 => address)) public minters;

    /// @notice NftAddress -> Token ID -> Royalty
    mapping(address => mapping(uint256 => uint16)) public royalties;

    /// @notice NftAddress -> Token ID -> Owner -> Listing item
    mapping(address => mapping(uint256 => mapping(address => Listing)))
        public listings;

    /// @notice NftAddress -> Token ID -> Offerer -> Offer
    mapping(address => mapping(uint256 => mapping(address => Offer)))
        public offers;

    /// @notice global platform fee, assumed to always be to 3 decimal place i.e. 25 = 0.025%
    uint256 public platformFee;

    /// @notice Platform fee Recipient
    address payable public feeRecipient;

    /// @notice NftAddress -> Royalty
    mapping(address => CollectionRoyalty) public collectionRoyalties;

    /// @notice Address registry
    IVolcanoAddressRegistry public addressRegistry;

    modifier onlyMarketplace() {
        require(
            address(addressRegistry.bundleMarketplace()) == msg.sender,
            "sender must be bundle marketplace"
        );
        _;
    }

    modifier isListed(
        address _nftAddress,
        uint256 _tokenId,
        address _owner
    ) {
        Listing memory listing = listings[_nftAddress][_tokenId][_owner];
        require(listing.quantity > 0, "not listed item");
        _;
    }

    modifier notListed(
        address _nftAddress,
        uint256 _tokenId,
        address _owner
    ) {
        Listing memory listing = listings[_nftAddress][_tokenId][_owner];
        require(listing.quantity == 0, "already listed");
        _;
    }

    modifier validListing(
        address _nftAddress,
        uint256 _tokenId,
        address _owner
    ) {
        Listing memory listedItem = listings[_nftAddress][_tokenId][_owner];

        _validOwner(_nftAddress, _tokenId, _owner, listedItem.quantity);

        require(_getNow() >= listedItem.startingTime, "item not buyable");
        _;
    }

    modifier offerExists(
        address _nftAddress,
        uint256 _tokenId,
        address _creator
    ) {
        Offer memory offer = offers[_nftAddress][_tokenId][_creator];
        require(
            offer.quantity > 0 && offer.deadline > _getNow(),
            "offer not exists or expired"
        );
        _;
    }

    modifier offerNotExists(
        address _nftAddress,
        uint256 _tokenId,
        address _creator
    ) {
        Offer memory offer = offers[_nftAddress][_tokenId][_creator];
        require(
            offer.quantity == 0 || offer.deadline <= _getNow(),
            "offer already created"
        );
        _;
    }

	/// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address payable _feeRecipient, uint256 _platformFee) initializer public {
        require(
            _feeRecipient != address(0),
            "VolcanoAuction: Invalid Platform Fee Recipient"
        );

        platformFee = _platformFee;
        feeRecipient = _feeRecipient;

        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}

    /// @notice Method for listing NFT
    /// @param _nftAddress Address of NFT contract
    /// @param _tokenId Token ID of NFT
    /// @param _quantity token amount to list (needed for ERC-1155 NFTs, set as 1 for ERC-721)
    /// @param _payToken Paying token
    /// @param _pricePerItem sale price for each iteam
    /// @param _startingTime scheduling for a future sale
    function listItem(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _quantity,
        address _payToken,
        uint256 _pricePerItem,
        uint256 _startingTime
    ) external notListed(_nftAddress, _tokenId, msg.sender) {
        if (IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC721)) {
            IERC721 nft = IERC721(_nftAddress);
            require(nft.ownerOf(_tokenId) == msg.sender, "not owning item");
            require(
                nft.isApprovedForAll(msg.sender, address(this)),
                "item not approved"
            );
        } else if (
            IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC1155)
        ) {
            IERC1155 nft = IERC1155(_nftAddress);
            require(
                nft.balanceOf(msg.sender, _tokenId) >= _quantity,
                "must hold enough nfts"
            );
            require(
                nft.isApprovedForAll(msg.sender, address(this)),
                "item not approved"
            );
        } else {
            revert("invalid nft address");
        }

        _validPayToken(_payToken);

        listings[_nftAddress][_tokenId][msg.sender] = Listing(
            _quantity,
            _payToken,
            _pricePerItem,
            _startingTime
        );
        emit ItemListed(
            msg.sender,
            _nftAddress,
            _tokenId,
            _quantity,
            _payToken,
            _pricePerItem,
            _startingTime
        );
    }

    /// @notice Method for canceling listed NFT
    function cancelListing(address _nftAddress, uint256 _tokenId)
        external
        nonReentrant
        isListed(_nftAddress, _tokenId, msg.sender)
    {
        _cancelListing(_nftAddress, _tokenId, msg.sender);
    }

    /// @notice Method for updating listed NFT
    /// @param _nftAddress Address of NFT contract
    /// @param _tokenId Token ID of NFT
    /// @param _payToken payment token
    /// @param _newPrice New sale price for each iteam
    function updateListing(
        address _nftAddress,
        uint256 _tokenId,
        address _payToken,
        uint256 _newPrice
    ) external nonReentrant isListed(_nftAddress, _tokenId, msg.sender) {
        Listing storage listedItem = listings[_nftAddress][_tokenId][
            msg.sender
        ];

        _validOwner(_nftAddress, _tokenId, msg.sender, listedItem.quantity);

        _validPayToken(_payToken);

        listedItem.payToken = _payToken;
        listedItem.pricePerItem = _newPrice;
        emit ItemUpdated(
            msg.sender,
            _nftAddress,
            _tokenId,
            _payToken,
            _newPrice
        );
    }

    /// @notice Method for buying listed NFT
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    function buyItem(
        address _nftAddress,
        uint256 _tokenId,
        address _payToken,
        address payable _owner
    )
        external
        payable		
        nonReentrant
        isListed(_nftAddress, _tokenId, _owner)
        validListing(_nftAddress, _tokenId, _owner)
    {
        /*
	Listing memory listedItem = listings[_nftAddress][_tokenId][_owner];
        require(listedItem.payToken == _payToken, "invalid pay token");
		if (_payToken == address(0)) {
			uint256 price = listedItem.pricePerItem.mul(listedItem.quantity);
			require(msg.value >= price, "insufficient balance to buy");		
		}
	*/
        _buyItem(_nftAddress, _tokenId, _payToken, _owner);
    }

    function _buyItem(
        address _nftAddress,
        uint256 _tokenId,
        address _payToken,
        address payable _owner
    ) private {
        Listing memory listedItem = listings[_nftAddress][_tokenId][_owner];
	
	require(listedItem.payToken == _payToken, "invalid pay token");

        uint256 price = listedItem.pricePerItem * listedItem.quantity;
        uint256 feeAmount = (price * platformFee) / 10000;
		
	if (_payToken == address(0)) {
		require(msg.value == price, "insufficient or incorrect value to buy");		
		(bool feeTransferSuccess, ) = feeRecipient.call{value: feeAmount}("");
		require(feeTransferSuccess, "VolcanoMarketplace: Fee transfer failed");
	} else {
		IERC20(_payToken).safeTransferFrom(
				msg.sender,
				feeRecipient,
				feeAmount
			);
	}

        address payable minter = payable(minters[_nftAddress][_tokenId]);
        uint16 royalty = royalties[_nftAddress][_tokenId];
        if (minter != address(0) && royalty != 0) {
            uint256 royaltyFee = ((price - feeAmount) * royalty) / 10000;

			if (_payToken == address(0)) {
				(bool royaltyFeeTransferSuccess, ) = minter.call{value: royaltyFee}("");
				require(royaltyFeeTransferSuccess, "VolcanoMarketplace: RoyaltyFee transfer failed");
			} else {
				IERC20(_payToken).safeTransferFrom(
					msg.sender,
					minter,
					royaltyFee
				);
			}

            feeAmount = feeAmount + royaltyFee;
        } else {
            minter = payable(collectionRoyalties[_nftAddress].feeRecipient);
            royalty = collectionRoyalties[_nftAddress].royalty;
            if (minter != address(0) && royalty != 0) {
                uint256 royaltyFee = ((price - feeAmount) * royalty) / 10000;
				if (_payToken == address(0)) {
					(bool royaltyFeeTransferSuccess, ) = minter.call{value: royaltyFee}("");
					require(royaltyFeeTransferSuccess, "VolcanoMarketplace: RoyaltyFee transfer failed");
				} else {
					IERC20(_payToken).safeTransferFrom(
						msg.sender,
						minter,
						royaltyFee
					);
				}

                feeAmount = feeAmount + royaltyFee;
            }
        }

		if (_payToken == address(0)) {
            (bool ownerTransferSuccess, ) = _owner.call{ value: price - feeAmount}("");
            require(ownerTransferSuccess, "VolcanoMarketplace: Owner transfer failed");		
		} else {
			IERC20(_payToken).safeTransferFrom(
				msg.sender,
				_owner,
				price - feeAmount
			);
		}

        // Transfer NFT to buyer
        if (IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC721)) {
            IERC721(_nftAddress).safeTransferFrom(
                _owner,
                msg.sender,
                _tokenId
            );
        } else {
            IERC1155(_nftAddress).safeTransferFrom(
                _owner,
                msg.sender,
                _tokenId,
                listedItem.quantity,
                bytes("")
            );
        }
        IVolcanoBundleMarketplace(addressRegistry.bundleMarketplace())
            .validateItemSold(_nftAddress, _tokenId, listedItem.quantity);

        emit ItemSold(
            _owner,
            msg.sender,
            _nftAddress,
            _tokenId,
            listedItem.quantity,
            _payToken,
            getPrice(_payToken),
            price / listedItem.quantity
        );
        delete (listings[_nftAddress][_tokenId][_owner]);
    }

    receive () external payable  {    
    }        

    /// @notice Method for offering item
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    /// @param _payToken Paying token
    /// @param _quantity Quantity of items
    /// @param _pricePerItem Price per item
    /// @param _deadline Offer expiration
    function createOffer(
        address _nftAddress,
        uint256 _tokenId,
        IERC20 _payToken,
        uint256 _quantity,
        uint256 _pricePerItem,
        uint256 _deadline
    )   external 
        payable		
        offerNotExists(_nftAddress, _tokenId, msg.sender) {
        require(
            IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC721) ||
                IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC1155),
            "invalid nft address"
        );

        IVolcanoAuction auction = IVolcanoAuction(addressRegistry.auction());

        (, , , uint256 startTime, , bool resulted) = auction.auctions(
            _nftAddress,
            _tokenId
        );

        require(
            startTime == 0 || resulted == true,
            "cannot place an offer if auction is going on"
        );

        require(_deadline > _getNow(), "invalid expiration");

        _validPayToken(address(_payToken));

        if (address(_payToken) == address(0)) {
            uint256 price = _pricePerItem * _quantity;
            require(msg.value == price, "insufficient or incorrect value to offer");		
        }     

        offers[_nftAddress][_tokenId][msg.sender] = Offer(
            _payToken,
            _quantity,
            _pricePerItem,
            _deadline
        );

        emit OfferCreated(
            msg.sender,
            _nftAddress,
            _tokenId,
            _quantity,
            address(_payToken),
            _pricePerItem,
            _deadline
        );
    }

    /// @notice Method for canceling the offer
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    function cancelOffer(address _nftAddress, uint256 _tokenId)
        external
        offerExists(_nftAddress, _tokenId, msg.sender)
    {
        Offer memory offer = offers[_nftAddress][_tokenId][msg.sender];
        if (address(offer.payToken) == address(0)) {
            uint256 price = offer.pricePerItem * offer.quantity;
            payable(msg.sender).transfer(price);
        } 
        delete (offers[_nftAddress][_tokenId][msg.sender]);
        emit OfferCanceled(msg.sender, _nftAddress, _tokenId);
    }

    /// @notice Method for accepting the offer
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    /// @param _creator Offer creator address
    function acceptOffer(
        address _nftAddress,
        uint256 _tokenId,
        address _creator
    ) external nonReentrant offerExists(_nftAddress, _tokenId, _creator) {
        Offer memory offer = offers[_nftAddress][_tokenId][_creator];

        _validOwner(_nftAddress, _tokenId, msg.sender, offer.quantity);

        uint256 price = offer.pricePerItem * offer.quantity;
        uint256 feeAmount = (price * platformFee) / 10000;
        uint256 royaltyFee;

        if (address(offer.payToken) == address(0)) {
            payable(feeRecipient).transfer(feeAmount);
        } else {
            offer.payToken.safeTransferFrom(_creator, feeRecipient, feeAmount);
        }

        address minter = minters[_nftAddress][_tokenId];
        uint16 royalty = royalties[_nftAddress][_tokenId];

        if (minter != address(0) && royalty != 0) {
            royaltyFee = ((price - feeAmount) * royalty) / 10000;
			if (address(offer.payToken) == address(0)) {
				payable(minter).transfer(royaltyFee);
			} else {            
                offer.payToken.safeTransferFrom(_creator, minter, royaltyFee);
            }
            feeAmount = feeAmount + royaltyFee;
        } else {
            minter = collectionRoyalties[_nftAddress].feeRecipient;
            royalty = collectionRoyalties[_nftAddress].royalty;
            if (minter != address(0) && royalty != 0) {
                royaltyFee = ((price - feeAmount) * royalty) / 10000;
                if (address(offer.payToken) == address(0)) {
                    payable(minter).transfer(royaltyFee);
                } else {                
                    offer.payToken.safeTransferFrom(_creator, minter, royaltyFee);
                }
                feeAmount = feeAmount + royaltyFee;
            }
        }

		if (address(offer.payToken) == address(0)) {
            payable(msg.sender).transfer(price - feeAmount);	
		} else {
            offer.payToken.safeTransferFrom(
                _creator,
                msg.sender,
                price - feeAmount
            );
        }

        // Transfer NFT to buyer
        if (IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC721)) {
            IERC721(_nftAddress).safeTransferFrom(
                msg.sender,
                _creator,
                _tokenId
            );
        } else {
            IERC1155(_nftAddress).safeTransferFrom(
                msg.sender,
                _creator,
                _tokenId,
                offer.quantity,
                bytes("")
            );
        }
        IVolcanoBundleMarketplace(addressRegistry.bundleMarketplace())
            .validateItemSold(_nftAddress, _tokenId, offer.quantity);

        emit ItemSold(
            msg.sender,
            _creator,
            _nftAddress,
            _tokenId,
            offer.quantity,
            address(offer.payToken),
            getPrice(address(offer.payToken)),
            offer.pricePerItem
        );

        emit OfferCanceled(_creator, _nftAddress, _tokenId);

        delete (listings[_nftAddress][_tokenId][msg.sender]);
        delete (offers[_nftAddress][_tokenId][_creator]);
    }

    /// @notice Method for setting royalty
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    /// @param _royalty Royalty
    function registerRoyalty(
        address _nftAddress,
        uint256 _tokenId,
        uint16 _royalty
    ) external {
        require(_royalty <= 10000, "invalid royalty");
        require(_isVolcanoNFT(_nftAddress), "invalid nft address");

        _validOwner(_nftAddress, _tokenId, msg.sender, 1);

        require(
            minters[_nftAddress][_tokenId] == address(0),
            "royalty already set"
        );
        minters[_nftAddress][_tokenId] = msg.sender;
        royalties[_nftAddress][_tokenId] = _royalty;
    }

    /// @notice Method for setting royalty
    /// @param _nftAddress NFT contract address
    /// @param _royalty Royalty
    function registerCollectionRoyalty(
        address _nftAddress,
        address _creator,
        uint16 _royalty,
        address _feeRecipient
    ) external onlyOwner {
        require(_creator != address(0), "invalid creator address");
        require(_royalty <= 10000, "invalid royalty");
        require(
            _royalty == 0 || _feeRecipient != address(0),
            "invalid fee recipient address"
        );
        require(!_isVolcanoNFT(_nftAddress), "invalid nft address");

        if (collectionRoyalties[_nftAddress].creator == address(0)) {
            collectionRoyalties[_nftAddress] = CollectionRoyalty(
                _royalty,
                _creator,
                _feeRecipient
            );
        } else {
            CollectionRoyalty storage collectionRoyalty = collectionRoyalties[
                _nftAddress
            ];

            collectionRoyalty.royalty = _royalty;
            collectionRoyalty.feeRecipient = _feeRecipient;
            collectionRoyalty.creator = _creator;
        }
    }

    function _isVolcanoNFT(address _nftAddress) internal view returns (bool) {
        return
            //addressRegistry.artion() == _nftAddress ||
            IVolcanoNFTFactory(addressRegistry.erc721factory()).exists(_nftAddress) ||
            //IVolcanoNFTFactory(addressRegistry.privateErc721Factory()).exists(_nftAddress) ||
            IVolcanoNFTFactory(addressRegistry.erc1155Factory()).exists(_nftAddress) /*||
            IVolcanoNFTFactory(addressRegistry.privateErc1155Factory()).exists(_nftAddress)*/;
    }

    /**
     @notice Method for getting price for pay token
     @param _payToken Paying token
     */
    function getPrice(address _payToken) public view returns (int256) {
        int256 unitPrice;
        uint8 decimals;
        IVolcanoPriceFeed priceFeed = IVolcanoPriceFeed(
            addressRegistry.priceFeed()
        );

        if (_payToken == address(0)) {
            (unitPrice, decimals) = priceFeed.getPrice(priceFeed.wFTM());
        } else {
            (unitPrice, decimals) = priceFeed.getPrice(_payToken);
        }
        if (decimals < 18) {
            unitPrice = unitPrice * (int256(10)**(18 - decimals));
        } else {
            unitPrice = unitPrice / (int256(10)**(decimals - 18));
        }

        return unitPrice;
    }

    /**
     @notice Method for updating platform fee
     @dev Only admin
     @param _platformFee uint16 the platform fee to set
     */
    function updatePlatformFee(uint16 _platformFee) external onlyOwner {
        platformFee = _platformFee;
        emit UpdatePlatformFee(_platformFee);
    }

    /**
     @notice Method for updating platform fee address
     @dev Only admin
     @param _platformFeeRecipient payable address the address to sends the funds to
     */
    function updatePlatformFeeRecipient(address payable _platformFeeRecipient)
        external
        onlyOwner
    {
        feeRecipient = _platformFeeRecipient;
        emit UpdatePlatformFeeRecipient(_platformFeeRecipient);
    }

    /**
     @notice Update VolcanoAddressRegistry contract
     @dev Only admin
     */
    function updateAddressRegistry(address _registry) external onlyOwner {
        addressRegistry = IVolcanoAddressRegistry(_registry);
    }

    /**
     * @notice Validate and cancel listing
     * @dev Only bundle marketplace can access
     */
    function validateItemSold(
        address _nftAddress,
        uint256 _tokenId,
        address _seller,
        address _buyer
    ) external onlyMarketplace {
        Listing memory item = listings[_nftAddress][_tokenId][_seller];
        if (item.quantity > 0) {
            _cancelListing(_nftAddress, _tokenId, _seller);
        }
        delete (offers[_nftAddress][_tokenId][_buyer]);
        emit OfferCanceled(_buyer, _nftAddress, _tokenId);
    }

    ////////////////////////////
    /// Internal and Private ///
    ////////////////////////////

    function _getNow() internal view virtual returns (uint256) {
        return block.timestamp;
    }

    function _validPayToken(address _payToken) internal view {
        require(
            _payToken == address(0) ||
                (addressRegistry.tokenRegistry() != address(0) &&
                    IVolcanoTokenRegistry(addressRegistry.tokenRegistry())
                        .enabled(_payToken)),
            "invalid pay token"
        );
    }

    function _validOwner(
        address _nftAddress,
        uint256 _tokenId,
        address _owner,
        uint256 quantity
    ) internal view {
        if (IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC721)) {
            IERC721 nft = IERC721(_nftAddress);
            require(nft.ownerOf(_tokenId) == _owner, "not owning item");
        } else if (
            IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC1155)
        ) {
            IERC1155 nft = IERC1155(_nftAddress);
            require(
                nft.balanceOf(_owner, _tokenId) >= quantity,
                "not owning item"
            );
        } else {
            revert("invalid nft address");
        }
    }

    function _cancelListing(
        address _nftAddress,
        uint256 _tokenId,
        address _owner
    ) private {
        Listing memory listedItem = listings[_nftAddress][_tokenId][_owner];

        _validOwner(_nftAddress, _tokenId, _owner, listedItem.quantity);

        delete (listings[_nftAddress][_tokenId][_owner]);
        emit ItemCanceled(_owner, _nftAddress, _tokenId);
    }
}
