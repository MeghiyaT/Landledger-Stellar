const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy PropertyToken
  console.log("\n1. Deploying PropertyToken...");
  const PropertyToken = await hre.ethers.getContractFactory("PropertyToken");
  const propertyToken = await PropertyToken.deploy(deployer.address);
  await propertyToken.waitForDeployment();
  const tokenAddress = await propertyToken.getAddress();
  console.log("PropertyToken deployed to:", tokenAddress);

  // Deploy PropertyRegistry
  console.log("\n2. Deploying PropertyRegistry...");
  const PropertyRegistry = await hre.ethers.getContractFactory("PropertyRegistry");
  const propertyRegistry = await PropertyRegistry.deploy(deployer.address);
  await propertyRegistry.waitForDeployment();
  const registryAddress = await propertyRegistry.getAddress();
  console.log("PropertyRegistry deployed to:", registryAddress);

  // Deploy Escrow
  console.log("\n3. Deploying Escrow...");
  let escrowAddress;
  try {
    const Escrow = await hre.ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(deployer.address, registryAddress, tokenAddress);
    await escrow.waitForDeployment();
    escrowAddress = await escrow.getAddress();
    console.log("Escrow deployed to:", escrowAddress);
  } catch (error) {
    console.error("Error deploying Escrow:", error.message);
    console.log("\nYou can deploy Escrow separately using: npm run deploy:escrow");
    console.log("Make sure to save the addresses above first!");
    throw error;
  }

  // Deploy PropertyOffers
  console.log("\n4. Deploying PropertyOffers...");
  let offersAddress;
  try {
    const PropertyOffers = await hre.ethers.getContractFactory("PropertyOffers");
    const propertyOffers = await PropertyOffers.deploy(deployer.address, registryAddress);
    await propertyOffers.waitForDeployment();
    offersAddress = await propertyOffers.getAddress();
    console.log("PropertyOffers deployed to:", offersAddress);
  } catch (error) {
    console.error("Error deploying PropertyOffers:", error.message);
    console.log("\nYou can deploy PropertyOffers separately using: npm run deploy:offers");
    console.log("Make sure to save the addresses above first!");
    throw error;
  }

  console.log("\n=== Deployment Summary ===");
  console.log("PropertyToken:", tokenAddress);
  console.log("PropertyRegistry:", registryAddress);
  console.log("Escrow:", escrowAddress);
  console.log("PropertyOffers:", offersAddress);

  // Save addresses to a file (only save what was successfully deployed)
  const fs = require("fs");
  const addresses = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      PropertyToken: tokenAddress,
      PropertyRegistry: registryAddress,
    },
    deployedAt: new Date().toISOString(),
  };

  // Only add contracts that were successfully deployed
  if (escrowAddress) {
    addresses.contracts.Escrow = escrowAddress;
  }
  if (offersAddress) {
    addresses.contracts.PropertyOffers = offersAddress;
  }

  fs.writeFileSync(
    "./deployment-addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses saved to deployment-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

