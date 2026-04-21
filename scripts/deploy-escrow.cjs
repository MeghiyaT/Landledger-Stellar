const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Escrow with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Try to load existing deployment addresses
  let existingAddresses = {};
  try {
    if (fs.existsSync("./deployment-addresses.json")) {
      const data = fs.readFileSync("./deployment-addresses.json", "utf8");
      existingAddresses = JSON.parse(data);
      console.log("\nFound existing deployment addresses:");
      console.log("PropertyToken:", existingAddresses.contracts?.PropertyToken || "Not found");
      console.log("PropertyRegistry:", existingAddresses.contracts?.PropertyRegistry || "Not found");
    }
  } catch (error) {
    console.log("No existing deployment file found, will deploy all contracts");
  }

  // Get required addresses
  const registryAddress = existingAddresses.contracts?.PropertyRegistry || process.env.PROPERTY_REGISTRY_ADDRESS;
  const tokenAddress = existingAddresses.contracts?.PropertyToken || process.env.PROPERTY_TOKEN_ADDRESS;

  if (!registryAddress || !tokenAddress) {
    console.error("\nError: PropertyRegistry and PropertyToken addresses are required!");
    console.error("Please set PROPERTY_REGISTRY_ADDRESS and PROPERTY_TOKEN_ADDRESS in .env");
    console.error("Or ensure deployment-addresses.json exists with these addresses");
    process.exit(1);
  }

  console.log("\nUsing addresses:");
  console.log("PropertyRegistry:", registryAddress);
  console.log("PropertyToken:", tokenAddress);

  // Deploy Escrow
  console.log("\nDeploying Escrow...");
  try {
    const Escrow = await hre.ethers.getContractFactory("Escrow");
    const escrow = await Escrow.deploy(deployer.address, registryAddress, tokenAddress);
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    console.log("Escrow deployed to:", escrowAddress);

    // Update deployment addresses
    const addresses = {
      ...existingAddresses,
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
      deployer: deployer.address,
      contracts: {
        ...existingAddresses.contracts,
        Escrow: escrowAddress,
      },
      deployedAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      "./deployment-addresses.json",
      JSON.stringify(addresses, null, 2)
    );
    console.log("\nAddresses saved to deployment-addresses.json");
  } catch (error) {
    console.error("\nError deploying Escrow:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



