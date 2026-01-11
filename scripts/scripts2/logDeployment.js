async function logDeployment(contractName, contract, provider) {
	  if (!contractName) {
    throw new Error("contractName is required");
  }
  if (!contract) {
    throw new Error("Contract instance is required");
  }
  const tx = contract.deploymentTransaction();
  if (!tx) {
    throw new Error("No deployment transaction found on contract");
  }
  //const receipt = await tx.wait();
	// DO NOT call tx.wait() if waitForDeployment() was already called
  const receipt = await tx.wait(1); // 1 confirmation is safest
  
  //const provider = contract.runner.provider;
  // Hardhat sometimes needs bigint → number conversion
  const blockNumber = Number(receipt.blockNumber);
  const block = await provider.getBlock(blockNumber);

  console.log("=== Contract Deployment Info ===");
  console.log("Name:        ", contractName);
  console.log("Address:     ", await contract.getAddress());
  console.log("Tx Hash:     ", tx.hash);
  console.log("Block Number:", receipt.blockNumber);
  console.log("Timestamp:  ", block.timestamp);
  console.log("Date:       ", new Date(block.timestamp * 1000).toISOString());
  console.log("================================");
}
module.exports = { logDeployment };
