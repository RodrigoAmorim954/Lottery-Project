const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("3")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    let vrfCoordinatorV2Address, subscriptionId
    const chainId = network.config.chainId

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transcationReceipt = await transactionResponse.wait(1)
        subscriptionId = transcationReceipt.events[0].args.subId
        // Fund the subscription
        // Usually, you'd need the link token on a real network
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const interval = networkConfig[chainId]["interval"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const entranceFee = networkConfig[chainId]["entranceFee"]

    const args = [
        entranceFee,
        vrfCoordinatorV2Address,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]

    const lottery = await deploy("Lottery", {
        from: deployer,
        args: args,

        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_URL) {
        log("verifying...")
        await verify(lottery.address, args)
    }
    log("--------------------")
}

module.exports.tags = ["all", "lottery"]

// For us to deploy and test the contract on a Test net we need:
// 1. Get our SubId for ChainLink VRF
// 2. Deploy our contract using the SubId
// 3. Register the contract with chainLink VRF & it's subId
// 4. Register the contract with chainlink Keepers
// 5. run staging test
