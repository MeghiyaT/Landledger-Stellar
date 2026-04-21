const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying PropertyNFT with the account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Deploy PropertyNFT
  console.log("\nDeploying PropertyNFT...");
  const PropertyNFT = await hre.ethers.getContractFactory("PropertyNFT");
  const propertyNFT = await PropertyNFT.deploy(deployer.address);
  await propertyNFT.waitForDeployment();
  const nftAddress = await propertyNFT.getAddress();
  console.log("PropertyNFT deployed to:", nftAddress);

  // Load existing deployment addresses or create new
  let addresses = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {},
    deployedAt: new Date().toISOString(),
  };

  // Try to load existing addresses
  try {
    const existing = JSON.parse(fs.readFileSync("./deployment-addresses.json", "utf8"));
    addresses = {
      ...existing,
      contracts: {
        ...existing.contracts,
        PropertyNFT: nftAddress,
      },
    };
  } catch (error) {
    // File doesn't exist, create new
    addresses.contracts.PropertyNFT = nftAddress;
  }

  // Save addresses
  fs.writeFileSync(
    "./deployment-addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nAddresses saved to deployment-addresses.json");
  console.log("\n=== Deployment Summary ===");
  console.log("PropertyNFT:", nftAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

