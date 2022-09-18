const { ethers, network } = require("hardhat")
const {
    TASK_COMPILE_SOLIDITY_HANDLE_COMPILATION_JOBS_FAILURES,
} = require("hardhat/builtin-tasks/task-names")

async function mockKeepers() {
    const lottery = await ethers.getContract("Lottery")
    const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""))
    const { upkeepNeeded } = await lottery.callStatic.checkUpkeep(checkData)
    if (upkeepNeeded) {
        const tx = await lottery.performUpkeep(checkData)
        const txReceipt = await tx.wait(1)
        const requestId = txReceipt.events[1].args.requestId
        console.log(`Performed upkeep with requestId: ${requestId}`)
        if (network.config.chainId == 31337) {
            await mockVrf(requestId, lottery)
        } else {
            console.log("No upkeep needed!")
        }
    }
}

async function mockVrf(requestId, lottery) {
    console.log("We on a local network? ok lets pretend...")
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    await vrfCoordinatorV2Mock.fulfiilRandomWords(requestId, lottery.address)
    console.log("responded!")
    const recentWinner = await lottery.getRecentWinner()
    console.log(`The winner is: ${recentWinner}`)
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
