// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

// PreFunded BondStaking 

//import "@openzeppelin/contracts@4.9.6/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.6/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts@4.9.6/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts@4.9.6/utils/math/Math.sol";
import "./VolcanoERC20FactoryInterface.sol";

contract VolcanoERC20Staking is ReentrancyGuard, VolcanoERC20StakingInterface/*, Ownable*/ {
    using SafeERC20 for IERC20;

    //mapping(address => IERC20) public Tokens; 
    //mapping(address => IERC20Permit) public TokensPermit;
    mapping(address => uint256) public RewardPool;

    address payable public PenaltyRecipient;

    // Penalty on early exit (e.g. 1% = 100 basis points)
    uint256 public earlyExitPenaltyBps = 100;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // duration => reward rate (scaled by 1e18)
    mapping(uint256 => uint256) public rewardRate;    

    struct StakeInfo {
        address token;
        uint256 amount;
        uint256 reward;
        uint256 unlockTime;
        bool claimed;
    }

    mapping(address => StakeInfo[]) public stakes;

    // Events
    event Staked( address indexed user, address token, uint256 amount, uint256 reward, uint256 unlockTime);
    event Unstaked( address indexed user, address token, uint256 amount, uint256 reward, uint256 penalty);

    constructor(address payable penaltyRecipient) {
        require(penaltyRecipient != address(0), "Recipient");     
        PenaltyRecipient = penaltyRecipient;
        // ---- Reward configuration ----
        rewardRate[30 days]  = 1e16;   // 1%
        rewardRate[90 days]  = 4e16;   // 4%
        rewardRate[180 days] = 10e16;  // 10%
        rewardRate[360 days] = 25e16;  // 25%        
    }

    function fundRewards(address token, uint256 amount) external /*onlyOwner*/ {
        require(token != address(0), "Token");        
        require(amount > 0, "Amount");          
        require(RewardPool[token] == 0, "Already");
        require(amount == IERC20(token).balanceOf(address(this)), "Liquidity");
        //IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        //Tokens[token] = IERC20(token);
        //TokensPermit[token] = IERC20Permit(token);               
        RewardPool[token] = amount;
    }

    /// @notice Stake tokens using permit (NO approve needed)
    function stakeWithPermit(
        address token, 
        uint256 amount,
        uint256 duration,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        require(token != address(0), "Token");
        require(amount > 0, "Amount");

        // 1. Approve via signature
        IERC20Permit(token).permit(
            msg.sender,
            address(this),
            amount,
            deadline,
            v,
            r,
            s
        );

        stake(token, amount, duration);
    }

    function stake(address token, uint256 amount, uint256 duration) public nonReentrant {
        uint256 rate = rewardRate[duration];
        require(token != address(0), "Token");
        require(rate > 0, "Duration");
        require(amount > 0, "Amount");
        uint256 reward = (amount * rate) / 1e18;
        require(reward <= RewardPool[token], "Exceed");

        RewardPool[token] -= reward; // reserve reward immediately

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        stakes[msg.sender].push(
            StakeInfo({
                token: token,
                amount: amount,
                reward: reward,
                unlockTime: block.timestamp + duration,
                claimed: false
            })
        );

        emit Staked(msg.sender, token, amount, reward, block.timestamp + duration);
    }

    //function unstakeExit(uint256 index) internal nonReentrant {
    function unstake(uint256 index) external nonReentrant {
        StakeInfo storage s = stakes[msg.sender][index];
        require(!s.claimed, "Claimed");
        require(block.timestamp >= s.unlockTime, "Locked");
        s.claimed = true;
        IERC20(s.token).transfer(msg.sender, s.amount + s.reward);
        emit Unstaked(msg.sender, s.token, s.amount, s.reward, 0);
    }

    function earlyExit(uint256 index) external nonReentrant {
        StakeInfo storage s = stakes[msg.sender][index];
        require(!s.claimed, "Claimed");
        require(block.timestamp < s.unlockTime, "Unlocked");
        s.claimed = true;
        uint256 penalty = (s.amount * earlyExitPenaltyBps) / BPS_DENOMINATOR;
        uint256 returnedAmount = s.amount - penalty;
        if (penalty > 0) {
            IERC20(s.token).transfer(PenaltyRecipient, penalty);
        }
        IERC20(s.token).transfer(msg.sender, returnedAmount);
        // Refund the reward to pool since user forfeits it
        RewardPool[s.token] += s.reward;
        emit Unstaked(msg.sender, s.token, returnedAmount, 0, penalty);
    }

    /*function unstake(uint256 index) external nonReentrant {
        if (block.timestamp >= stakes[msg.sender][index].unlockTime) {
            unstakeExit(index);
        } else {
            earlyExit(index);
        }
    }*/    

    function stakeCount(address user) external view returns (uint256) {
        return stakes[user].length;
    }

    function rescueERC20(IERC20 token, uint256 amount) external {
        //require(address(_token) != address(token), "Cannot rescue staking token");
        require(RewardPool[address(token)] == 0, "Cannot rescue staked");
        token.safeTransfer(PenaltyRecipient, amount);
    }
}
