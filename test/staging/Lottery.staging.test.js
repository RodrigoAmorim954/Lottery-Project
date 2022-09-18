const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Unit Test", async () => {
          let lottery, lotteryEntranceFee, deployer

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer //
              lottery = await ethers.getContract("Lottery", deployer) // returns a new connection to the raffle contract
              lotteryEntranceFee = await lottery.getEntranceFee()
          })

          describe("fulfillRandomWords", () => {
              it("works with live chainlink Keepers and chainlink VRF, we get a random winner", async () => {
                  // enter the lottery
                  console.log("setting up test...")
                  const startingTimeStamp = await lottery.getLatestTimeStamp()
                  const accounts = await ethers.getSigners()

                  console.log("Setting up listener... ")
                  await new Promise(async (resolve, reject) => {
                      // setup listener before we went the lottery
                      // just in case the blockchain moves Really fest
                      lottery.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          try {
                              // add our asserts here
                              const recentWinner = await lottery.getRecentWinner()
                              const lotteryState = await lottery.getLotteryState()
                              const endingTimeStamp = await lottery.getLatestTimeStamp()
                              const winnerEndingBalance = await accounts[0].getBalance()

                              await expect(lottery.getPlayer(0)).to.be.reverted
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(lotteryEntranceFee).toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                      })
                      // then entering the lottery
                      console.log("Entering Lottery")
                      const tx = await lottery.enterLottery({ value: lotteryEntranceFee })
                      const txReceipt = await tx.wait(1)
                      console.log("Ok, time to wait....")
                      const winnerStartingBalance = await accounts[0].getBalance()
                  })
              })
          })
      })
