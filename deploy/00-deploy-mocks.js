const { developmentChains, networkConfig } = require("../helper-hardhat-config.js")
const { network } = require("hardhat")

const BASE_FEE = ethers.utils.parseEther("0.25") // 0.25 is the premium. It cost 0.25 LINK per request
const GAS_PRICE_LINK = 1e9 // Link per gas. calculated value based on the gas price of the chain
// So they price of request change based on the price of gas

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying Mocks...")
        // Deploy a mock vrfcoordinator...
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
            waitConfirmations: 1,
        })
        log("Mocks Deployed")
        log("-------------------------")
    }
}

module.exports.tags = ["all", "tags"]
