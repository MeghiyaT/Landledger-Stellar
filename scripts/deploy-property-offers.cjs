const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying PropertyOffers with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Try to load existing deployment addresses
  let existingAddresses = {};
  try {
    if (fs.existsSync("./deployment-addresses.json")) {
      const data = fs.readFileSync("./deployment-addresses.json", "utf8");
      existingAddresses = JSON.parse(data);
      console.log("\nFound existing deployment addresses:");
      console.log("PropertyRegistry:", existingAddresses.contracts?.PropertyRegistry || "Not found");
    }
  } catch (error) {
    console.log("No existing deployment file found");
  }

  // Get required address
  const registryAddress = existingAddresses.contracts?.PropertyRegistry || process.env.PROPERTY_REGISTRY_ADDRESS;

  if (!registryAddress) {
    console.error("\nError: PropertyRegistry address is required!");
    console.error("Please set PROPERTY_REGISTRY_ADDRESS in .env");
    console.error("Or ensure deployment-addresses.json exists with PropertyRegistry address");
    process.exit(1);
  }

  console.log("\nUsing PropertyRegistry address:", registryAddress);

  // Deploy PropertyOffers
  console.log("\nDeploying PropertyOffers...");
  try {
    const PropertyOffers = await hre.ethers.getContractFactory("PropertyOffers");
    const propertyOffers = await PropertyOffers.deploy(deployer.address, registryAddress);
    await propertyOffers.waitForDeployment();
    const offersAddress = await propertyOffers.getAddress();
    console.log("PropertyOffers deployed to:", offersAddress);

    // Update deployment addresses
    const addresses = {
      ...existingAddresses,
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
      deployer: deployer.address,
      contracts: {
        ...existingAddresses.contracts,
        PropertyOffers: offersAddress,
      },
      deployedAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      "./deployment-addresses.json",
      JSON.stringify(addresses, null, 2)
    );
    console.log("\nAddresses saved to deployment-addresses.json");
  } catch (error) {
    console.error("\nError deploying PropertyOffers:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

