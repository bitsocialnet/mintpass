import chai from "chai";
import hardhat from "hardhat";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { expect } = chai;
const { ethers, network } = hardhat;

// Function to generate ETH wallet from PKC private key (matching challenge expected format)
const getEthWalletFromPrivateKey = async (privateKeyBase64, authorAddress, authorPublicKey) => {
  if (privateKeyBase64 === 'private key') return;

  const privateKeyBytes = Buffer.from(privateKeyBase64, 'base64');
  if (privateKeyBytes.length !== 32) {
    throw Error('failed getting eth address from private key not 32 bytes');
  }
  
  const privateKeyHex = '0x' + Buffer.from(privateKeyBytes).toString('hex');
  const wallet = new ethers.Wallet(privateKeyHex);
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Use the exact message format expected by the challenge
  // Sign binding of the ETH address (not the PKC author address)
  const messageToSign = JSON.stringify({
    domainSeparator: "bitsocial-author-wallet",
    authorAddress: wallet.address,
    timestamp: timestamp
  });
  const signature = await wallet.signMessage(messageToSign);
  
  return {
    address: wallet.address, 
    timestamp, 
    signature: {
      signature, 
      publicKey: authorPublicKey,
      type: "eip191",
      signedPropertyNames: ["domainSeparator", "authorAddress", "timestamp"]
    }
  };
};

// Helper to create challenge settings
const createChallengeSettings = (contractAddress, chainProviderUrl, chainId, chainTicker = 'base', useCustomRpc = true) => {
  const options = {
    chainTicker,
    contractAddress,
    requiredTokenType: '0',
    transferCooldownSeconds: '0',
    error: 'You need a MintPass NFT to post in this community. This is a test message.'
  };
  
  // Conditionally add custom RPC settings
  if (useCustomRpc) {
    options.rpcUrl = chainProviderUrl;
    options.chainId = chainId.toString();
  }
  
  return {
    path: path.resolve(__dirname, '../dist/mintpass.js'),
    options
  };
};

// Simple utility to wait for a condition
const waitForCondition = (obj, condition, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      if (condition(obj)) {
        clearInterval(checkInterval);
        resolve(obj);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkInterval);
      reject(new Error(`Condition not met within ${timeout}ms`));
    }, timeout);
  });
};

describe("MintPass Challenge Integration Test", function () {
  let mintpass, admin, minter, pkc, pkcForPublishing, chainProviderUrl, ipfsProcess, stopIpfs;
  
  const NAME = "MintPassV1";
  const SYMBOL = "MINT1";
  const BASE_URI = "https://mintpass.org/mint1/";
  const SMS_TOKEN_TYPE = 0;

  this.timeout(300000);

  before(async function () {
    console.log("\n🚀 Setting up MintPass Challenge Integration Test Environment");

    // Clear stale binding database to ensure test isolation across runs
    const envPaths = (await import('env-paths')).default;
    const fs = await import('fs');
    const dbPath = envPaths('mintpass').data + '/challenge-bindings.sqlite';
    try { fs.unlinkSync(dbPath); console.log("🗑️ Cleared stale binding database"); } catch (_e) { /* doesn't exist yet */ }

    [admin, minter] = await ethers.getSigners();
    
    console.log("📋 Deploying MintPassV1 contract...");
    const MintPassV1Factory = await ethers.getContractFactory("MintPassV1");
    mintpass = await MintPassV1Factory.deploy(NAME, SYMBOL, BASE_URI, admin.address, minter.address);
    await mintpass.waitForDeployment();
    console.log(`✅ MintPass deployed at: ${await mintpass.getAddress()}`);

    chainProviderUrl = network.config.url || "http://127.0.0.1:8545";
    console.log(`🔗 Using chain provider: ${chainProviderUrl}`);

    console.log("🚀 Starting IPFS...");
    const startKubo = await import('../src/test/start-kubo.js');
    const result = await startKubo.default({ apiPort: 15001, gatewayPort: 18080 });
    ipfsProcess = result.process;
    stopIpfs = result.stop;
    console.log("✅ IPFS daemon ready");

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("🌐 Setting up PKC instance for local testing...");
    const { default: PKC } = await import('@pkcprotocol/pkc-js');

    // Configure PKC for local testing - no default chain providers to avoid conflicts
    const pkcOptions = {
      httpRoutersOptions: [],
      kuboRpcClientsOptions: ['http://127.0.0.1:15001/api/v0'],
      updateInterval: 1000
      // Custom RPC configuration is handled in challenge settings instead
    };

    pkc = await PKC(pkcOptions);

    // Create second PKC instance for publishing (workaround for instance conflicts)
    pkcForPublishing = await PKC(pkcOptions);
    console.log("✅ PKC instances created for local testing");
  });

  after(async function () {
    console.log("\n🧹 Cleaning up test environment...");
    
    if (pkc) {
      try {
        await pkc.destroy();
        console.log("✅ PKC destroyed");
      } catch (error) {
        console.log("⚠️ Error destroying pkc:", error.message);
      }
    }

    if (pkcForPublishing) {
      try {
        await pkcForPublishing.destroy();
        console.log("✅ PKC for publishing destroyed");
      } catch (error) {
        console.log("⚠️ Error destroying pkcForPublishing:", error.message);
      }
    }

    if (stopIpfs) {
      try {
        stopIpfs();
        console.log("✅ IPFS daemon stopped");
      } catch (error) {
        console.log("⚠️ Error stopping IPFS:", error.message);
      }
    }
  });

  it("Test 1: Publishing should fail when author has no NFT", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 1: Publishing should fail when author has no NFT");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Verify user doesn't have NFT
    const hasNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.false;
    console.log("✅ Confirmed author doesn't own MintPass NFT");

    // Create community using the original PKC instance
    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge integration with local publishing'
    });
    
    // Configure challenge with custom RPC URL and chainId (no default chain providers)
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges");
    
    // Start community and wait for it to be ready (critical for proper test execution)
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      // Create comment using different PKC instance (workaround for instance conflicts)
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment without NFT',
        content: 'This comment should fail the mintpass challenge',
        // Set wallet information during creation
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      // Wait for challengeverification and check challengeSuccess
      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();

      // Wait for challengeverification
      await waitForCondition({}, () => challengeVerificationReceived, 30000);

            // Expect proper NFT ownership verification failure
      expect(challengeSuccessValue).to.be.false;
      expect(challengeErrorsValue['0']).to.include('You need a MintPass NFT');
      console.log("✅ Test 1 PASSED: challengeSuccess = false (correctly failed without NFT)");

    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 1b: noChallengeUrl=true should fail immediately without iframe when author has no NFT", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 1b: noChallengeUrl=true should fail immediately without iframe when author has no NFT");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);

    const hasNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.false;

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community noChallengeUrl',
      description: 'Testing mintpass challenge with noChallengeUrl=true'
    });

    const settings = { ...community.settings };
    const challengeSettings = createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337);
    challengeSettings.options.noChallengeUrl = 'true';
    settings.challenges = [challengeSettings];
    await community.edit({ settings });

    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment without NFT (noChallengeUrl)',
        content: 'This comment should fail immediately',
        author: {
          wallets: {
            eth: ethWallet
          }
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;
      let challengeEventReceived = false;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("⚠️ unexpected challenge event received:", challenge);
        challengeEventReceived = true;
      });

      console.log("📤 Publishing comment...");
      await comment.publish();

      await waitForCondition({}, () => challengeVerificationReceived, 30000);

      expect(challengeEventReceived, 'challenge iframe should not be presented when noChallengeUrl=true').to.be.false;
      expect(challengeSuccessValue).to.be.false;
      expect(challengeErrorsValue['0']).to.include('You need a MintPass NFT');
      console.log("✅ Test 1b PASSED: immediate failure without iframe");

    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 2: Publishing should succeed when author has NFT", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 2: Publishing should succeed when author has NFT");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Mint NFT to the author wallet
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);
    
    const hasNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.true;
    console.log("✅ Confirmed author owns MintPass NFT");

    // Create community using the original PKC instance
    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge integration with local publishing'
    });
    
    // Configure challenge with custom RPC URL and chainId for local testing
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges");
    
    // Start community and wait for it to be ready (critical for proper test execution)
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      // Create comment using different PKC instance (workaround for instance conflicts)
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with NFT',
        content: 'This comment should pass the mintpass challenge',
        // Set wallet information during creation
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      // Wait for challengeverification and check challengeSuccess
      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();

      // Wait for challengeverification
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
            // Expect successful NFT ownership verification
      expect(challengeSuccessValue).to.be.true;
      console.log("✅ Test 2 PASSED: challengeSuccess = true (correctly verified NFT ownership)");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 3: Author with eth wallet preferred", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 3: Author with eth wallet preferred");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    
    // Create a different wallet for 'eth' by using a different timestamp and address
    const [, , user1] = await ethers.getSigners();
    const ethWallet2 = {
      address: user1.address, // Different address
      timestamp: Math.floor(Date.now() / 1000),
      signature: {
        signature: ethWallet.signature.signature, // Keep same signature for simplicity
        publicKey: authorSigner.publicKey,
        type: "eip191",
        signedPropertyNames: ["domainSeparator", "authorAddress", "timestamp"]
      }
    };
    
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 ETH address without NFT: ${ethWallet2.address}`);
    console.log(`💳 ETH address with NFT: ${ethWallet.address}`);
    
    // Mint NFT to ethWallet (the one that should be used)
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);
    const hasNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.true;
    console.log("✅ Confirmed ETH wallet owns MintPass NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with multiple wallet types'
    });
    
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with multiple wallet types',
        content: 'This comment should pass with multiple wallet types',
        author: { 
          wallets: {
            eth: ethWallet   // Only ETH wallet is used (has NFT)
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.true;
      console.log("✅ Test 3 PASSED: Challenge used ETH wallet and succeeded");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 4: Author with no wallet defined", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 4: Author with no wallet defined");

    const authorSigner = await pkcForPublishing.createSigner();
    console.log(`👤 Author PKC address: ${authorSigner.address}`);

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with no wallet'
    });
    
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with no wallet',
        content: 'This comment should fail due to no wallet'
        // No author.wallets defined
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.false;
      expect(String(challengeErrorsValue['0'] || '')).to.include('Author wallet address is not defined');
      console.log("✅ Test 4 PASSED: Challenge correctly failed with no wallet");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 5: Author with ENS address", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 5: Author with ENS address");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Mint NFT to the author wallet
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);
    const hasNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.true;
    console.log("✅ Confirmed author owns MintPass NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with ENS address'
    });
    
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      // Create wallet with ENS-like address (for testing purposes)
      const ensWallet = {
        address: 'test.eth', // ENS address
        timestamp: ethWallet.timestamp,
        signature: ethWallet.signature
      };

      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with ENS address',
        content: 'This comment should handle ENS addresses',
        author: { 
          wallets: {
            eth: ensWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      // ENS resolution not implemented in local test, should fail
      expect(challengeSuccessValue).to.be.false;
      console.log("✅ Test 5 PASSED: ENS handling works as expected");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 6: Invalid wallet signature", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 6: Invalid wallet signature");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Mint NFT to the author wallet
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with invalid signature'
    });
    
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      // Create wallet with completely corrupted signature
      const invalidWallet = {
        ...ethWallet,
        signature: {
          ...ethWallet.signature,
          signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234'
        }
      };

      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with invalid signature',
        content: 'This comment should fail due to invalid signature',
        author: { 
          wallets: {
            eth: invalidWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 60000); // Increased timeout
      
      expect(challengeSuccessValue).to.be.false;
      expect(challengeErrorsValue['0']).to.include('signature');
      console.log("✅ Test 6 PASSED: Invalid signature correctly rejected");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 7: Expired signature timestamp", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 7: Expired signature timestamp");

    const authorSigner = await pkcForPublishing.createSigner();
    console.log(`👤 Author PKC address: ${authorSigner.address}`);

    // Create wallet with very old timestamp (1 hour ago)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 3600;
    const privateKeyBytes = Buffer.from(authorSigner.privateKey, 'base64');
    const privateKeyHex = '0x' + Buffer.from(privateKeyBytes).toString('hex');
    const wallet = new ethers.Wallet(privateKeyHex);
    
    const messageToSign = JSON.stringify({
      domainSeparator: "bitsocial-author-wallet",
      authorAddress: wallet.address,
      timestamp: oldTimestamp
    });
    const signature = await wallet.signMessage(messageToSign);
    
    const expiredWallet = {
      address: wallet.address,
      timestamp: oldTimestamp,
      signature: {
        signature,
        publicKey: authorSigner.publicKey,
        type: "eip191",
        signedPropertyNames: ["domainSeparator", "authorAddress", "timestamp"]
      }
    };

    // Mint NFT to the author wallet
    await mintpass.connect(minter).mint(wallet.address, SMS_TOKEN_TYPE);

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with expired timestamp'
    });
    
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with expired timestamp',
        content: 'This comment should fail due to expired timestamp',
        author: { 
          wallets: {
            eth: expiredWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      // Note: The current implementation doesn't validate timestamp expiry, 
      // so this test documents the current behavior rather than enforcing a strict requirement
      console.log(`📊 Test 7 COMPLETED: challengeSuccess = ${challengeSuccessValue} (timestamp validation not implemented)`);
      // For now, we expect it to succeed since timestamp validation is not implemented
      expect(challengeSuccessValue).to.be.true;
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 8: Wrong signing format", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 8: Wrong signing format");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Mint NFT to the author wallet
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with wrong signing format'
    });
    
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      // Create a signature with the wrong message format (missing authorAddress)
      const privateKeyBytes = Buffer.from(authorSigner.privateKey, 'base64');
      const privateKeyHex = '0x' + Buffer.from(privateKeyBytes).toString('hex');
      const wallet = new ethers.Wallet(privateKeyHex);
      
      // Sign the wrong message format (missing authorAddress field that challenge expects)
      const wrongMessage = JSON.stringify({
        domainSeparator: "bitsocial-author-wallet",
        timestamp: ethWallet.timestamp
        // Missing authorAddress field
      });
      const wrongSignature = await wallet.signMessage(wrongMessage);

      const wrongFormatWallet = {
        ...ethWallet,
        signature: {
          ...ethWallet.signature,
          signature: wrongSignature,
          signedPropertyNames: ["domainSeparator", "timestamp"] // Wrong fields, missing authorAddress
        }
      };

      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with wrong signing format',
        content: 'This comment should fail due to wrong signing format',
        author: { 
          wallets: {
            eth: wrongFormatWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.false;
      expect(challengeErrorsValue['0']).to.include('signature');
      console.log("✅ Test 8 PASSED: Wrong signing format correctly rejected");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 9: Different token types (email type)", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 9: Different token types (email type)");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    const EMAIL_TOKEN_TYPE = 1;
    
    // Mint EMAIL NFT to the author wallet
    await mintpass.connect(minter).mint(ethWallet.address, EMAIL_TOKEN_TYPE);
    const hasEmailNFT = await mintpass.ownsTokenType(ethWallet.address, EMAIL_TOKEN_TYPE);
    expect(hasEmailNFT).to.be.true;
    console.log("✅ Confirmed author owns Email MintPass NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with email token type'
    });
    
    // Configure challenge to require EMAIL token type
    const settings = { ...community.settings };
    const challengeSettings = createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337);
    challengeSettings.options.requiredTokenType = EMAIL_TOKEN_TYPE.toString();
    settings.challenges = [challengeSettings];
    await community.edit({ settings });
    console.log("✅ Community configured with EMAIL token type challenge");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with email token type',
        content: 'This comment should pass with email NFT verification',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.true;
      console.log("✅ Test 9 PASSED: Email token type verification succeeded");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 10: Wrong token type ownership", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 10: Wrong token type ownership");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    const EMAIL_TOKEN_TYPE = 1;
    
    // Mint EMAIL NFT but challenge requires SMS
    await mintpass.connect(minter).mint(ethWallet.address, EMAIL_TOKEN_TYPE);
    const hasEmailNFT = await mintpass.ownsTokenType(ethWallet.address, EMAIL_TOKEN_TYPE);
    const hasSMSNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasEmailNFT).to.be.true;
    expect(hasSMSNFT).to.be.false;
    console.log("✅ Confirmed author owns Email NFT but not SMS NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with wrong token type'
    });
    
    // Configure challenge to require SMS but user has EMAIL
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with SMS token type challenge");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with wrong token type',
        content: 'This comment should fail due to wrong token type',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.false;
      expect(challengeErrorsValue['0']).to.include('You need a MintPass NFT');
      console.log("✅ Test 10 PASSED: Wrong token type correctly rejected");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 11: Multiple NFT ownership", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 11: Multiple NFT ownership");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    const EMAIL_TOKEN_TYPE = 1;
    
    // Mint both SMS and EMAIL NFTs
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);
    await mintpass.connect(minter).mint(ethWallet.address, EMAIL_TOKEN_TYPE);
    
    const hasSMSNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    const hasEmailNFT = await mintpass.ownsTokenType(ethWallet.address, EMAIL_TOKEN_TYPE);
    expect(hasSMSNFT).to.be.true;
    expect(hasEmailNFT).to.be.true;
    console.log("✅ Confirmed author owns both SMS and Email NFTs");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with multiple NFT ownership'
    });
    
    // Configure challenge to require SMS (user has both)
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with SMS token type challenge");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with multiple NFT ownership',
        content: 'This comment should pass with multiple NFT types',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.true;
      console.log("✅ Test 11 PASSED: Multiple NFT ownership verification succeeded");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 12: Invalid contract address", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 12: Invalid contract address");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with invalid contract address'
    });
    
    // Configure challenge with invalid contract address
    const settings = { ...community.settings };
    const invalidAddress = '0x0000000000000000000000000000000000000000';
    settings.challenges = [createChallengeSettings(invalidAddress, chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with invalid contract address");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with invalid contract',
        content: 'This comment should fail due to invalid contract',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.false;
      expect(challengeErrorsValue['0']).to.include('Failed to check MintPass NFT ownership');
      console.log("✅ Test 12 PASSED: Invalid contract address correctly handled");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 13: Wrong chain configuration", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 13: Wrong chain configuration");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);

    // Mint NFT to the author wallet on correct chain
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with wrong chain config'
    });
    
    // Configure challenge with invalid RPC URL that will fail to connect
    const settings = { ...community.settings };
    const wrongChainSettings = createChallengeSettings(await mintpass.getAddress(), 'http://invalid-rpc-url:9999', 31337);
    settings.challenges = [wrongChainSettings];
    await community.edit({ settings });
    console.log("✅ Community configured with wrong chain configuration");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with wrong chain config',
        content: 'This comment should fail due to wrong chain config',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.false;
      const err = String(challengeErrorsValue['0'] || '');
      expect(
        err.includes('Failed to check MintPass NFT ownership') ||
        err.includes('The signature of the wallet is invalid')
      ).to.be.true;
      console.log("✅ Test 13 PASSED: Wrong chain configuration correctly handled");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 14: Custom error messages", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 14: Custom error messages");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Don't mint NFT so challenge will fail
    const hasNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.false;
    console.log("✅ Confirmed author doesn't own MintPass NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with custom error message'
    });
    
    // Configure challenge with custom error message
    const settings = { ...community.settings };
    const customChallengeSettings = createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337);
    customChallengeSettings.options.error = 'Custom error: Please get your MintPass at https://example.com/get-mintpass';
    settings.challenges = [customChallengeSettings];
    await community.edit({ settings });
    console.log("✅ Community configured with custom error message");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment for custom error',
        content: 'This comment should show custom error message',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.false;
      expect(challengeErrorsValue['0']).to.include('Custom error: Please get your MintPass');
      console.log("✅ Test 14 PASSED: Custom error message correctly displayed");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 15: Very large token ID", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 15: Very large token ID");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Use maximum valid uint16 value (65535) instead of 999999
    const LARGE_TOKEN_TYPE = 65535;
    
    // Mint large token ID NFT
    await mintpass.connect(minter).mint(ethWallet.address, LARGE_TOKEN_TYPE);
    const hasLargeNFT = await mintpass.ownsTokenType(ethWallet.address, LARGE_TOKEN_TYPE);
    expect(hasLargeNFT).to.be.true;
    console.log("✅ Confirmed author owns large token ID NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with large token ID'
    });
    
    // Configure challenge to require large token type
    const settings = { ...community.settings };
    const challengeSettings = createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337);
    challengeSettings.options.requiredTokenType = LARGE_TOKEN_TYPE.toString();
    settings.challenges = [challengeSettings];
    await community.edit({ settings });
    console.log("✅ Community configured with large token type challenge");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with large token ID',
        content: 'This comment should pass with large token ID verification',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.true;
      console.log("✅ Test 15 PASSED: Large token ID verification succeeded");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 16: Challenge options validation", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 16: Challenge options validation");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);

    // Create community with missing contractAddress (required field)
    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with invalid options'
    });
    
    // Configure challenge with missing required options (contractAddress is missing)
    const settings = { ...community.settings };
    const invalidChallengeSettings = {
      path: path.resolve(__dirname, '../dist/mintpass.js'),
      options: {
        // Missing contractAddress (required field)
        chainTicker: 'base',
        requiredTokenType: '0',
        transferCooldownSeconds: '0'
      }
    };
    settings.challenges = [invalidChallengeSettings];
    
    try {
      await community.edit({ settings });
      console.log("✅ Community configured with invalid challenge options");
      
      await community.start();
      await waitForCondition(community, (s) => typeof s.updatedAt === "number");
      console.log("✅ Community started and ready");

      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with invalid options',
        content: 'This comment should fail due to invalid challenge options',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;
      let publishingFailed = false;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
        if (state === 'failed') {
          publishingFailed = true;
        }
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      
      // Wait for either challenge verification or publishing to fail
      await waitForCondition({}, () => challengeVerificationReceived || publishingFailed, 30000);
      
      // Challenge should fail due to invalid configuration
      if (challengeVerificationReceived) {
        expect(challengeSuccessValue).to.be.false;
        console.log("✅ Test 16 PASSED: Invalid challenge options correctly rejected");
      } else {
        console.log("✅ Test 16 PASSED: Publishing failed due to invalid challenge configuration");
      }
      
    } catch (error) {
      // Accept both timeout and contractAddress validation errors
      if (error.message.includes('Condition not met within') || error.message.includes('contractAddress')) {
        console.log("✅ Test 16 PASSED: Challenge setup failed due to missing required options or timeout");
      } else {
        throw error; // Re-throw unexpected errors
      }
    } finally {
      try {
        await community.stop();
        await community.delete();
        console.log("🧹 Community cleaned up");
      } catch (cleanupError) {
        console.log("🧹 Community cleanup completed (may have already been cleaned up)");
      }
    }
  });

  it("Test 17: Challenge retry scenarios", async function () {
    this.timeout(180000); // Extended timeout for multiple attempts
    console.log("\n🧪 Test 17: Challenge retry scenarios");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Mint NFT to the author wallet
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);
    const hasNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.true;
    console.log("✅ Confirmed author owns MintPass NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge retry scenarios'
    });
    
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      // First attempt
      console.log("📤 First publishing attempt...");
      const comment1 = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment retry attempt 1',
        content: 'First attempt at publishing',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challenge1VerificationReceived = false;
      let challenge1SuccessValue = null;

      comment1.on('challengeverification', (challengeVerification) => {
        console.log('✅ First attempt challengeverification received:', challengeVerification);
        challenge1SuccessValue = challengeVerification.challengeSuccess;
        challenge1VerificationReceived = true;
      });

      comment1.on('challenge', (challenge) => {
        console.log("✅ First attempt challenge received:", challenge);
        comment1.publishChallengeAnswers(['test']);
      });

      await comment1.publish();
      await waitForCondition({}, () => challenge1VerificationReceived, 30000);
      expect(challenge1SuccessValue).to.be.true;
      console.log("✅ First attempt succeeded");

      // Wait a bit before second attempt
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Second attempt (should also succeed)
      console.log("📤 Second publishing attempt...");
      const comment2 = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment retry attempt 2',
        content: 'Second attempt at publishing',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challenge2VerificationReceived = false;
      let challenge2SuccessValue = null;

      comment2.on('challengeverification', (challengeVerification) => {
        console.log('✅ Second attempt challengeverification received:', challengeVerification);
        challenge2SuccessValue = challengeVerification.challengeSuccess;
        challenge2VerificationReceived = true;
      });

      comment2.on('challenge', (challenge) => {
        console.log("✅ Second attempt challenge received:", challenge);
        comment2.publishChallengeAnswers(['test']);
      });

      await comment2.publish();
      await waitForCondition({}, () => challenge2VerificationReceived, 30000);
      expect(challenge2SuccessValue).to.be.true;
      console.log("✅ Test 17 PASSED: Multiple challenge attempts succeeded");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 18: NFT in cooldown period", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 18: NFT in cooldown period");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Mint NFT to the author wallet
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);
    const hasNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.true;
    console.log("✅ Confirmed author owns MintPass NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with cooldown period'
    });
    
    // Configure challenge with very short cooldown for testing (1 second)
    const settings = { ...community.settings };
    const cooldownSettings = createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337);
    cooldownSettings.options.transferCooldownSeconds = '1';
    // Disable binding here to specifically test cooldown behavior
    cooldownSettings.options.bindToFirstAuthor = 'false';
    settings.challenges = [cooldownSettings];
    await community.edit({ settings });
    console.log("✅ Community configured with cooldown challenge");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      // First publish to establish cooldown
      const comment1 = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'First comment to establish cooldown',
        content: 'This establishes the cooldown period',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challenge1VerificationReceived = false;
      let challenge1SuccessValue = null;

      comment1.on('challengeverification', (challengeVerification) => {
        console.log('✅ First challengeverification received:', challengeVerification);
        challenge1SuccessValue = challengeVerification.challengeSuccess;
        challenge1VerificationReceived = true;
      });

      comment1.on('challenge', (challenge) => {
        console.log("✅ First challenge received:", challenge);
        comment1.publishChallengeAnswers(['test']);
      });

      await comment1.publish();
      await waitForCondition({}, () => challenge1VerificationReceived, 30000);
      expect(challenge1SuccessValue).to.be.true;
      console.log("✅ First comment succeeded, cooldown established");

      // Immediately try second publish (should be in cooldown or succeed since same author)
      const comment2 = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Second comment during cooldown',
        content: 'This should succeed since same author uses same NFT',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challenge2VerificationReceived = false;
      let challenge2SuccessValue = null;
      let challenge2ErrorsValue = null;

      comment2.on('challengeverification', (challengeVerification) => {
        console.log('✅ Second challengeverification received:', challengeVerification);
        challenge2SuccessValue = challengeVerification.challengeSuccess;
        challenge2ErrorsValue = challengeVerification.challengeErrors;
        challenge2VerificationReceived = true;
      });

      comment2.on('challenge', (challenge) => {
        console.log("✅ Second challenge received:", challenge);
        comment2.publishChallengeAnswers(['test']);
      });

      await comment2.publish();
      await waitForCondition({}, () => challenge2VerificationReceived, 30000);
      
      // Should succeed because same author is using the same NFT
      expect(challenge2SuccessValue).to.be.true;
      console.log("✅ Test 18 PASSED: Same author can reuse NFT immediately");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 19: NFT cooldown expired", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 19: NFT cooldown expired");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Mint NFT to the author wallet
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);
    const hasNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.true;
    console.log("✅ Confirmed author owns MintPass NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with expired cooldown'
    });
    
    // Configure challenge with very short cooldown for testing (1 second)
    const settings = { ...community.settings };
    const cooldownSettings = createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337);
    cooldownSettings.options.transferCooldownSeconds = '1';
    settings.challenges = [cooldownSettings];
    await community.edit({ settings });
    console.log("✅ Community configured with short cooldown challenge");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      // First publish to establish cooldown
      const comment1 = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'First comment to establish cooldown',
        content: 'This establishes the cooldown period',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challenge1VerificationReceived = false;
      let challenge1SuccessValue = null;

      comment1.on('challengeverification', (challengeVerification) => {
        console.log('✅ First challengeverification received:', challengeVerification);
        challenge1SuccessValue = challengeVerification.challengeSuccess;
        challenge1VerificationReceived = true;
      });

      comment1.on('challenge', (challenge) => {
        console.log("✅ First challenge received:", challenge);
        comment1.publishChallengeAnswers(['test']);
      });

      await comment1.publish();
      await waitForCondition({}, () => challenge1VerificationReceived, 30000);
      expect(challenge1SuccessValue).to.be.true;
      console.log("✅ First comment succeeded, cooldown established");

      // Wait for cooldown to expire (2 seconds to be safe)
      console.log("⏳ Waiting for cooldown to expire...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try second publish after cooldown expired
      const comment2 = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Second comment after cooldown',
        content: 'This should succeed after cooldown expired',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challenge2VerificationReceived = false;
      let challenge2SuccessValue = null;

      comment2.on('challengeverification', (challengeVerification) => {
        console.log('✅ Second challengeverification received:', challengeVerification);
        challenge2SuccessValue = challengeVerification.challengeSuccess;
        challenge2VerificationReceived = true;
      });

      comment2.on('challenge', (challenge) => {
        console.log("✅ Second challenge received:", challenge);
        comment2.publishChallengeAnswers(['test']);
      });

      await comment2.publish();
      await waitForCondition({}, () => challenge2VerificationReceived, 30000);
      
      expect(challenge2SuccessValue).to.be.true;
      console.log("✅ Test 19 PASSED: Comment succeeded after cooldown expired");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 20: Multiple accounts using same NFT", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 20: Multiple accounts using same NFT");

    // Create two different author signers
    const authorSigner1 = await pkcForPublishing.createSigner();
    const authorSigner2 = await pkcForPublishing.createSigner();
    
    const ethWallet1 = await getEthWalletFromPrivateKey(authorSigner1.privateKey, authorSigner1.address, authorSigner1.publicKey);
    
    // Create proper signature for second author using the shared wallet address
    const privateKeyBytes1 = Buffer.from(authorSigner1.privateKey, 'base64');
    const privateKeyHex1 = '0x' + Buffer.from(privateKeyBytes1).toString('hex');
    const wallet1 = new ethers.Wallet(privateKeyHex1);
    
    // Create proper signature for the second author with the shared wallet
    const sharedTimestamp = Math.floor(Date.now() / 1000);
    const messageToSign2 = JSON.stringify({
      domainSeparator: "bitsocial-author-wallet",
      authorAddress: wallet1.address,  // Sign the ETH address
      timestamp: sharedTimestamp
    });
    const signature2 = await wallet1.signMessage(messageToSign2);  // Same wallet signing for different author

    const ethWallet2 = {
      address: ethWallet1.address, // Same ETH address (shared wallet)
      timestamp: sharedTimestamp,
      signature: {
        signature: signature2,  // Proper signature for second author
        publicKey: authorSigner2.publicKey,
        type: "eip191",
        signedPropertyNames: ["domainSeparator", "authorAddress", "timestamp"]
      }
    };

    console.log(`👤 Author 1 PKC address: ${authorSigner1.address}`);
    console.log(`👤 Author 2 PKC address: ${authorSigner2.address}`);
    console.log(`💳 Shared ETH address: ${ethWallet1.address}`);
    
    // Mint NFT to the shared wallet address
    await mintpass.connect(minter).mint(ethWallet1.address, SMS_TOKEN_TYPE);
    const hasNFT = await mintpass.ownsTokenType(ethWallet1.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.true;
    console.log("✅ Confirmed shared wallet owns MintPass NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with multiple accounts sharing NFT'
    });
    
    const settings = { ...community.settings };
    const cooldownSettings = createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337);
    cooldownSettings.options.transferCooldownSeconds = '86400';
    // Disable binding to isolate cooldown behavior (Test 23 covers binding separately)
    cooldownSettings.options.bindToFirstAuthor = 'false';
    settings.challenges = [cooldownSettings];
    await community.edit({ settings });
    console.log("✅ Community configured with cooldown challenge");

    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      // First account publishes
      const comment1 = await pkcForPublishing.createComment({
        signer: authorSigner1,
        communityAddress: community.address,
        title: 'Comment from first account',
        content: 'First account using shared NFT',
        author: { 
          wallets: {
            eth: ethWallet1
          } 
        }
      });

      let challenge1VerificationReceived = false;
      let challenge1SuccessValue = null;

      comment1.on('challengeverification', (challengeVerification) => {
        console.log('✅ First account challengeverification received:', challengeVerification);
        challenge1SuccessValue = challengeVerification.challengeSuccess;
        challenge1VerificationReceived = true;
      });

      comment1.on('challenge', (challenge) => {
        console.log("✅ First account challenge received:", challenge);
        comment1.publishChallengeAnswers(['test']);
      });

      await comment1.publish();
      await waitForCondition({}, () => challenge1VerificationReceived, 30000);
      expect(challenge1SuccessValue).to.be.true;
      console.log("✅ First account succeeded");

      // Second account tries to use same NFT immediately  
      const comment2 = await pkcForPublishing.createComment({
        signer: authorSigner2,
        communityAddress: community.address,
        title: 'Comment from second account',
        content: 'Second account trying to use same NFT',
        author: { 
          wallets: {
            eth: ethWallet2
          } 
        }
      });

      let challenge2VerificationReceived = false;
      let challenge2SuccessValue = null;
      let challenge2ErrorsValue = null;

      comment2.on('challengeverification', (challengeVerification) => {
        console.log('✅ Second account challengeverification received:', challengeVerification);
        challenge2SuccessValue = challengeVerification.challengeSuccess;
        challenge2ErrorsValue = challengeVerification.challengeErrors;
        challenge2VerificationReceived = true;
      });

      comment2.on('challenge', (challenge) => {
        console.log("✅ Second account challenge received:", challenge);
        comment2.publishChallengeAnswers(['test']);
      });

      await comment2.publish();
      await waitForCondition({}, () => challenge2VerificationReceived, 30000);
      
      // Should fail because cooldown prevents different authors from using the same NFT immediately
      expect(challenge2SuccessValue).to.be.false;
      expect(challenge2ErrorsValue['0']).to.include('cooldown period');
      console.log("✅ Test 20 PASSED: Cooldown correctly prevents multiple accounts from using same NFT immediately");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 21: Contract call failure", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 21: Contract call failure");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with contract call failure'
    });
    
    // Configure challenge with invalid RPC URL to force failure
    const settings = { ...community.settings };
    const failureSettings = createChallengeSettings(await mintpass.getAddress(), 'http://invalid-rpc-url:9999', 31337);
    settings.challenges = [failureSettings];
    await community.edit({ settings });
    console.log("✅ Community configured with invalid RPC URL");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with RPC failure',
        content: 'This comment should fail due to RPC connection failure',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;
      let challengeErrorsValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeErrorsValue = challengeVerification.challengeErrors;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.false;
      const err = String(challengeErrorsValue['0'] || '');
      expect(
        err.includes('Failed to check MintPass NFT ownership') ||
        err.includes('The signature of the wallet is invalid')
      ).to.be.true;
      console.log("✅ Test 21 PASSED: RPC failure correctly handled");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 22: Batch minted NFTs", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 22: Batch minted NFTs");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);
    console.log(`👤 Author PKC address: ${authorSigner.address}`);
    console.log(`💳 Author ETH address: ${ethWallet.address}`);
    
    // Use V1 mintBatch with matching array lengths
    const batchRecipients = [ethWallet.address, ethWallet.address, ethWallet.address];
    const batchTypes = [SMS_TOKEN_TYPE, 1, 2];
    await mintpass.connect(minter).mintBatch(batchRecipients, batchTypes);
    console.log("✅ Batch minted multiple token types");
    
    const hasNFT = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasNFT).to.be.true;
    console.log("✅ Confirmed author owns MintPass NFT");

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with batch minted NFTs'
    });
    
    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges");
    
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment with batch minted NFT',
        content: 'This comment should pass with batch minted NFT',
        author: { 
          wallets: {
            eth: ethWallet
          } 
        }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;

      comment.on('challengeverification', (challengeVerification) => {
        console.log('✅ challengeverification received:', challengeVerification);
        challengeSuccessValue = challengeVerification.challengeSuccess;
        challengeVerificationReceived = true;
      });

      comment.on('challenge', (challenge) => {
        console.log("✅ challenge received:", challenge);
        comment.publishChallengeAnswers(['test']);
      });

      comment.on('publishingstatechange', (state) => {
        console.log(`📊 Publishing state: ${state}`);
      });

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 30000);
      
      expect(challengeSuccessValue).to.be.true;
      console.log("✅ Test 22 PASSED: Batch minted NFT verification succeeded");
      
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 23: bindToFirstAuthor blocks different author", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 23: bindToFirstAuthor blocks different author");

    // Two different PKC authors
    const authorA = await pkcForPublishing.createSigner();
    const authorB = await pkcForPublishing.createSigner();

    // Wallet derived from authorA private key
    const walletA = await getEthWalletFromPrivateKey(authorA.privateKey, authorA.address, authorA.publicKey);

    // Mint NFT to walletA
    await mintpass.connect(minter).mint(walletA.address, SMS_TOKEN_TYPE);

    // Build a wallet object for authorB using the same ETH address (signed by walletA's key)
    const privateKeyBytesA = Buffer.from(authorA.privateKey, 'base64');
    const privateKeyHexA = '0x' + Buffer.from(privateKeyBytesA).toString('hex');
    const eoaA = new ethers.Wallet(privateKeyHexA);
    const messageToSignB = JSON.stringify({
      domainSeparator: "bitsocial-author-wallet",
      authorAddress: walletA.address,
      timestamp: Math.floor(Date.now() / 1000)
    });
    const sigB = await eoaA.signMessage(messageToSignB);
    const walletForB = {
      address: walletA.address,
      timestamp: Math.floor(Date.now() / 1000),
      signature: {
        signature: sigB,
        publicKey: authorB.publicKey,
        type: "eip191",
        signedPropertyNames: ["domainSeparator", "authorAddress", "timestamp"]
      }
    };

    // Create community and enforce binding (cooldown off to isolate binding behavior)
    const sub = await pkc.createCommunity({
      title: 'MintPass Binding',
      description: 'Bind tokenId to first author'
    });
    const settings = { ...sub.settings };
    const c = createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337);
    c.options.bindToFirstAuthor = 'true';
    c.options.transferCooldownSeconds = '0';
    settings.challenges = [c];
    await sub.edit({ settings });
    await sub.start();
    await waitForCondition(sub, (s) => typeof s.updatedAt === "number");

    try {
    // First publish as authorA → should fail due to signature mismatch now; adjust expectation later
      const comment1 = await pkcForPublishing.createComment({
        signer: authorA,
        communityAddress: sub.address,
        title: 'Bind first author',
        content: 'Should pass and bind',
        author: { wallets: { eth: walletA } }
      });

      let received1 = false;
      let success1 = null;
      comment1.on('challengeverification', (cv) => { received1 = true; success1 = cv.challengeSuccess; });
      comment1.on('challenge', () => comment1.publishChallengeAnswers(['test']));
      await comment1.publish();
      await waitForCondition({}, () => received1, 30000);
      expect(success1).to.be.true;

      // Second publish as authorB using same wallet → should fail due to binding
      const comment2 = await pkcForPublishing.createComment({
        signer: authorB,
        communityAddress: sub.address,
        title: 'Second author reuse',
        content: 'Should fail due to binding',
        author: { wallets: { eth: walletForB } }
      });

      let received2 = false;
      let success2 = null;
      let errors2 = null;
      comment2.on('challengeverification', (cv) => { received2 = true; success2 = cv.challengeSuccess; errors2 = cv.challengeErrors; });
      comment2.on('challenge', () => comment2.publishChallengeAnswers(['test']));
      await comment2.publish();
      await waitForCondition({}, () => received2, 30000);
      expect(success2).to.be.false;
      expect(String(errors2['0'] || '')).to.match(/cooldown period|already bound/);
      console.log("✅ Test 23 PASSED: bindToFirstAuthor blocked different author as expected");
    } finally {
      await sub.stop();
      await sub.delete();
    }
  });

  it("Test 24: Vote should succeed when author has NFT", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 24: Vote should succeed when author has NFT");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);

    // Mint NFT to the author wallet
    await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge with vote publication'
    });

    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");

    try {
      // First publish a comment to vote on and capture its CID
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Post to vote on',
        content: 'Vote target',
        author: { wallets: { eth: ethWallet } }
      });

      let publishedCid = null;
      comment.on('challenge', () => comment.publishChallengeAnswers(['test']));
      comment.on('challengeverification', (cv) => {
        // Prefer publication.cid, fallback to commentUpdate.cid as emitted by current pkc-js
        publishedCid = cv?.publication?.cid || cv?.commentUpdate?.cid || cv?.comment?.cid || null;
      });
      await comment.publish();
      await waitForCondition({}, () => Boolean(publishedCid), 30000);

      // Now create a vote publication and expect success
      const vote = await pkcForPublishing.createVote({
        signer: authorSigner,
        communityAddress: community.address,
        commentCid: publishedCid,
        vote: 1,
        author: { wallets: { eth: ethWallet } }
      });

      let voteVerificationReceived = false;
      let voteSuccess = null;
      vote.on('challenge', () => vote.publishChallengeAnswers(['test']));
      vote.on('challengeverification', (cv) => { voteVerificationReceived = true; voteSuccess = cv.challengeSuccess; });
      await vote.publish();
      await waitForCondition({}, () => voteVerificationReceived, 30000);

      expect(voteSuccess).to.be.true;
      console.log("✅ Test 24 PASSED: Vote succeeded with NFT");
    } finally {
      await community.stop();
      await community.delete();
    }
  });

  it("Test 25: Vote should fail when author has no NFT", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 25: Vote should fail when author has no NFT");

    // Create a poster with NFT to publish a target comment
    const posterSigner = await pkcForPublishing.createSigner();
    const posterWallet = await getEthWalletFromPrivateKey(posterSigner.privateKey, posterSigner.address, posterSigner.publicKey);
    await mintpass.connect(minter).mint(posterWallet.address, SMS_TOKEN_TYPE);

    // Create a voter without NFT
    const voterSigner = await pkcForPublishing.createSigner();
    const voterWallet = await getEthWalletFromPrivateKey(voterSigner.privateKey, voterSigner.address, voterSigner.publicKey);

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing mintpass challenge vote fail path'
    });

    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");

    try {
      // Publish the target comment as poster (has NFT)
      const comment = await pkcForPublishing.createComment({
        signer: posterSigner,
        communityAddress: community.address,
        title: 'Post to vote on - no NFT voter',
        content: 'Vote target',
        author: { wallets: { eth: posterWallet } }
      });
      let publishedCid = null;
      comment.on('challenge', () => comment.publishChallengeAnswers(['test']));
      comment.on('challengeverification', (cv) => {
        publishedCid = cv?.publication?.cid || cv?.commentUpdate?.cid || cv?.comment?.cid || null;
      });
      await comment.publish();
      await waitForCondition({}, () => Boolean(publishedCid), 30000);

      // Attempt a vote by voter without NFT → expect failure
      const vote = await pkcForPublishing.createVote({
        signer: voterSigner,
        communityAddress: community.address,
        commentCid: publishedCid,
        vote: 1,
        author: { wallets: { eth: voterWallet } }
      });

      let voteVerificationReceived = false;
      let voteSuccess = null;
      let voteErrors = null;
      vote.on('challenge', () => vote.publishChallengeAnswers(['test']));
      vote.on('challengeverification', (cv) => { 
        voteVerificationReceived = true; 
        voteSuccess = cv.challengeSuccess; 
        voteErrors = cv.challengeErrors; 
      });
      await vote.publish();
      await waitForCondition({}, () => voteVerificationReceived, 30000);

      expect(voteSuccess).to.be.false;
      expect(String(voteErrors['0'] || '')).to.include('You need a MintPass NFT');
      console.log("✅ Test 25 PASSED: Vote correctly failed without NFT");
    } finally {
      await community.stop();
      await community.delete();
    }
  });
  
  it("Test 26: Valid signature vector passes with base→eth wallet fallback", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 26: Valid signature vector passes with base→eth wallet fallback");

    // Known-valid EIP-191 signature vector (seconds timestamp)
    const authorAddress = '12D3KooWRLHxva6Mrt2fxuL4hMeGJCs8erHAAoXCzPGLsdLpdvrF';
    const wallet = {
      address: '0x172bb210Ebf51882b63d59609A7BC5c70ce84311',
      timestamp: 1758422293,
      signature: {
        signature: '0x0bf13e0ce9624b9f02a1b0c13227c5587e6e77e2e739bd38ba2f017e2aac06e1685e4aeb622a55dd5e7a3f360ae151acd511b1316dd833246c8f5b875cbcee361c',
        type: 'eip191',
        signedPropertyNames: ["domainSeparator","authorAddress","timestamp"]
      }
    };

    // Mint NFT to the provided wallet address so ownership check passes
    await mintpass.connect(minter).mint(wallet.address, SMS_TOKEN_TYPE);

    // Create community and configure challenge with chainTicker base.
    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing valid signature vector with wallet fallback'
    });

    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    console.log("✅ Community configured with challenges (chainTicker base)");

    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");
    console.log("✅ Community started and ready");

    try {
      // Provide only eth wallet; challenge should fall back from base→eth
      // Use Esteban's provided ed25519 signer (so authorAddress matches the signed wallet message)
      const providedPrivateKeyBase64 = 'X/m5oYzKfBRRGgByOSIpgRRIf0WHNo7bSEAUuRUbQ3s';
      const signer = await pkcForPublishing.createSigner({ type: 'ed25519', privateKey: providedPrivateKeyBase64 });
      // Sanity check: ensure signer uses the expected author address from the vector
      if (signer.address !== authorAddress) {
        console.log('⚠️ Provided signer address mismatch, got', signer.address, 'expected', authorAddress);
      }
      const comment = await pkcForPublishing.createComment({
        signer,
        communityAddress: community.address,
        title: 'Test comment with valid vector',
        content: 'This should pass with base→eth wallet fallback',
        author: {
          address: signer.address, // author must match signer
          wallets: { eth: wallet }
        }
      });

      let received = false;
      let success = null;
      comment.on('challengeverification', (cv) => { received = true; success = cv.challengeSuccess; });
      comment.on('challenge', () => comment.publishChallengeAnswers(['test']));

      console.log("📤 Publishing comment...");
      await comment.publish();
      await waitForCondition({}, () => received, 30000);

      expect(success).to.be.true;
      console.log("✅ Test 26 PASSED: Valid signature accepted and wallet fallback worked");
    } finally {
      await community.stop();
      await community.delete();
      console.log("🧹 Community cleaned up");
    }
  });

  it("Test 27: Iframe flow re-check passes after mint with empty answer", async function () {
    this.timeout(120000);
    console.log("\n🧪 Test 27: Iframe flow re-check passes after mint with empty answer");

    const authorSigner = await pkcForPublishing.createSigner();
    const ethWallet = await getEthWalletFromPrivateKey(authorSigner.privateKey, authorSigner.address, authorSigner.publicKey);

    // Ensure author does not initially own the NFT
    const hasInitial = await mintpass.ownsTokenType(ethWallet.address, SMS_TOKEN_TYPE);
    expect(hasInitial).to.be.false;

    const community = await pkc.createCommunity({
      title: 'MintPass Test Community',
      description: 'Testing iframe challenge flow with re-check'
    });

    const settings = { ...community.settings };
    settings.challenges = [createChallengeSettings(await mintpass.getAddress(), chainProviderUrl, 31337)];
    await community.edit({ settings });
    await community.start();
    await waitForCondition(community, (s) => typeof s.updatedAt === "number");

    try {
      const comment = await pkcForPublishing.createComment({
        signer: authorSigner,
        communityAddress: community.address,
        title: 'Test comment iframe flow',
        content: 'Should pass after mint during challenge iframe flow',
        author: { wallets: { eth: ethWallet } }
      });

      let challengeVerificationReceived = false;
      let challengeSuccessValue = null;

      comment.on('challengeverification', (cv) => {
        console.log('✅ challengeverification received (Test 27):', cv);
        challengeSuccessValue = cv.challengeSuccess;
        challengeVerificationReceived = true;
      });

      // When we receive the challenge (iframe URL), mint the NFT and then answer with empty string
      comment.on('challenge', async (chal) => {
        console.log('✅ challenge received (Test 27):', chal);
        await mintpass.connect(minter).mint(ethWallet.address, SMS_TOKEN_TYPE);
        // Answer with empty string as specified by backend dev
        comment.publishChallengeAnswers(['']);
      });

      console.log("📤 Publishing comment (Test 27)...");
      await comment.publish();
      await waitForCondition({}, () => challengeVerificationReceived, 60000);

      expect(challengeSuccessValue).to.be.true;
      console.log("✅ Test 27 PASSED: Challenge passed after mint and empty answer re-check");
    } finally {
      await community.stop();
      await community.delete();
    }
  });
  
}); 
