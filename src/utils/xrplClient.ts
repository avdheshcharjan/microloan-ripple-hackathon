import { Client, Wallet, NFTokenMint, Payment, TxResponse, TrustSet, AccountSet } from 'xrpl';

// XRPL Client setup for Testnet
const client = new Client('wss://s.altnet.rippletest.net:51233');

// DID Creation Functions:
// - createDIDTransaction: Auto-detects wallet type and uses appropriate method
// - createDIDTransactionWithCrossmark: For Crossmark wallets (no seed available)
// - createDIDTransaction: For seed-based wallets (has private key access)

export interface XRPLWallet {
  address: string;
  seed: string;
  balance: string;
  signTransaction?: (tx: any) => Promise<string>;
  submitTransaction?: (txBlob: string) => Promise<string>;
}

export interface MicroloanNFT {
  nftId: string;
  borrower: string;
  amount: number;
  purpose: string;
  interestRate: number;
  duration: string;
  txHash: string;
}

export interface AccountBalance {
  currency: string;
  value: string;
  issuer?: string;
}

// RLUSD issuer address on testnet
const RLUSD_ISSUER = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV';

// Convert RLUSD to proper hex format for XRPL transactions
const RLUSD_HEX = '524C555344000000000000000000000000000000'; // 'RLUSD' padded to 40 hex chars

// Browser-compatible hex encoding function
const stringToHex = (str: string): string => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
};

// Browser-compatible hex decoding function
const hexToString = (hex: string): string => {
  try {
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch (error) {
    console.error('Error decoding hex string:', error);
    return '';
  }
};

// Validate XRPL seed format
const isValidXRPLSeed = (seed: string): boolean => {
  if (!seed || typeof seed !== 'string') return false;
  const trimmedSeed = seed.trim();

  // XRPL seeds typically start with 's' and are base58 encoded
  // They should be between 25-34 characters long
  return trimmedSeed.startsWith('s') &&
    trimmedSeed.length >= 25 &&
    trimmedSeed.length <= 34 &&
    /^[sS][1-9A-HJ-NP-Za-km-z]+$/.test(trimmedSeed); // Base58 pattern
};

// Safe wallet creation from seed with better error handling
const createWalletFromSeed = (seed: string): Wallet => {
  if (!isValidXRPLSeed(seed)) {
    throw new Error('Invalid XRPL seed format. Seeds should start with "s" and be 25-34 characters long using base58 encoding.');
  }

  try {
    const wallet = Wallet.fromSeed(seed.trim());

    return wallet;
  } catch (error) {
    console.error('❌ Failed to create wallet from seed:', error);
    if (error instanceof Error) {
      if (error.message.includes('invalid_input_size')) {
        throw new Error('Invalid seed format: The seed appears to be corrupted or improperly encoded.');
      } else if (error.message.includes('decoded data must have length')) {
        throw new Error('Invalid seed length: The seed is too short or malformed.');
      }
      throw new Error(`Seed decode error: ${error.message}`);
    }
    throw new Error('Unknown error occurred while creating wallet from seed');
  }
};

// Connect to XRPL
export const connectXRPL = async (): Promise<void> => {
  if (!client.isConnected()) {
    await client.connect();
  }
};

// Create trust line for RLUSD
export const createRLUSDTrustLine = async (wallet: Wallet): Promise<string> => {
  await connectXRPL();

  const trustSet: TrustSet = {
    TransactionType: 'TrustSet',
    Account: wallet.address,
    LimitAmount: {
      currency: RLUSD_HEX, // Use hex-encoded currency
      issuer: RLUSD_ISSUER,
      value: '1000000' // 1 million RLUSD limit
    }
  };

  const response: TxResponse<TrustSet> = await client.submitAndWait(trustSet, { wallet });
  return response.result.hash || '';
};

// Check if trust line exists
export const checkTrustLineExists = async (address: string, currency: string, issuer: string): Promise<boolean> => {
  await connectXRPL();

  try {
    console.log(`🔍 [Trust Line Check] Checking for ${currency} trust line on address: ${address}`);
    console.log(`🔍 [Trust Line Check] Looking for issuer: ${issuer}`);
    
    const response = await client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated'
    });

    const lines = response.result.lines || [];
    console.log(`🔍 [Trust Line Check] Found ${lines.length} trust lines:`, lines);
    
    // Check each line for debugging
    lines.forEach((line: any, index: number) => {
      // Decode hex currency codes to readable names
      let decodedCurrency = line.currency;
      if (line.currency.length > 3 && line.currency.match(/^[0-9A-F]+$/i)) {
        const decoded = hexToString(line.currency);
        // Remove null bytes and check if it's a valid readable string
        const cleanDecoded = decoded.replace(/\0/g, '').trim();
        if (cleanDecoded && cleanDecoded.match(/^[A-Za-z0-9]+$/)) {
          decodedCurrency = cleanDecoded;
        }
      }
      
      console.log(`🔍 [Trust Line Check] Line ${index + 1}:`, {
        currency: line.currency,
        decodedCurrency: decodedCurrency,
        account: line.account,
        balance: line.balance
      });
    });
    
    const hasLine = lines.some((line: any) => {
      // Decode hex currency codes to readable names for comparison
      let lineCurrency = line.currency;
      if (line.currency.length > 3 && line.currency.match(/^[0-9A-F]+$/i)) {
        const decoded = hexToString(line.currency);
        // Remove null bytes and check if it's a valid readable string
        const cleanDecoded = decoded.replace(/\0/g, '').trim();
        if (cleanDecoded && cleanDecoded.match(/^[A-Za-z0-9]+$/)) {
          lineCurrency = cleanDecoded;
        }
      }
      
      const currencyMatch = lineCurrency === currency;
      const issuerMatch = line.account === issuer;
      
      console.log(`🔍 [Trust Line Check] Comparing line:`, {
        lineCurrency,
        targetCurrency: currency,
        currencyMatch,
        lineIssuer: line.account,
        targetIssuer: issuer,
        issuerMatch
      });
      
      return currencyMatch && issuerMatch;
    });
    
    console.log(`🔍 [Trust Line Check] Result: ${hasLine ? 'FOUND' : 'NOT FOUND'}`);
    return hasLine;
  } catch (error) {
    console.error('Could not check trust line:', error);
    return false;
  }
};

// Create a new XRPL wallet
export const createXRPLWallet = async (): Promise<XRPLWallet> => {
  await connectXRPL();

  const wallet = Wallet.generate();

  // Fund the wallet on testnet (for demo purposes)
  try {
    await client.fundWallet(wallet);
  } catch (error) {
    // Wallet funding might have failed, but wallet created
    console.warn('Wallet funding failed:', error);
  }

  // Get account balance with retry logic
  let balance = '0';
  let retries = 3;
  while (retries > 0) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      const accountInfo = await client.request({
        command: 'account_info',
        account: wallet.address,
        ledger_index: 'validated'
      });
      balance = accountInfo.result.account_data.Balance;
      break;
    } catch (error) {
      console.warn(`Could not fetch balance, retries left: ${retries - 1}`, error);
      retries--;
      if (retries === 0) {
        // Using default balance of 0
      }
    }
  }


  // Validate the generated seed before returning
  if (!wallet.seed) {
    throw new Error('Failed to generate wallet seed');
  }




  return {
    address: wallet.address,
    seed: wallet.seed,
    balance: (parseInt(balance) / 1000000).toString() // Convert drops to XRP
  };
};

// Get account balances (XRP + tokens)
export const getAccountBalances = async (address: string): Promise<AccountBalance[]> => {
  await connectXRPL();

  try {
    const [accountInfo, accountLines] = await Promise.all([
      client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      }),
      client.request({
        command: 'account_lines',
        account: address,
        ledger_index: 'validated'
      })
    ]);

    const balances: AccountBalance[] = [];

    // Add XRP balance
    const xrpBalance = (parseInt(accountInfo.result.account_data.Balance) / 1000000).toString();
    balances.push({
      currency: 'XRP',
      value: xrpBalance
    });

    // Add all token balances (including zero balances if trust line exists)
    const lines = accountLines.result.lines || [];
    lines.forEach((line: any) => {
      // Show all trust lines, even with zero balance
      // Decode hex currency codes to readable names
      let currency = line.currency;
      if (currency.length > 3 && currency.match(/^[0-9A-F]+$/i)) {
        const decoded = hexToString(currency);
        // Remove null bytes and check if it's a valid readable string
        const cleanDecoded = decoded.replace(/\0/g, '').trim();
        if (cleanDecoded && cleanDecoded.match(/^[A-Za-z0-9]+$/)) {
          currency = cleanDecoded;
        }
      }

      balances.push({
        currency: currency,
        value: line.balance,
        issuer: line.account
      });
    });

    // Sort balances: XRP first, then by currency name
    balances.sort((a, b) => {
      if (a.currency === 'XRP') return -1;
      if (b.currency === 'XRP') return 1;
      return a.currency.localeCompare(b.currency);
    });

    return balances;
  } catch (error) {
    console.error('Could not fetch balances:', error);
    return [{ currency: 'XRP', value: '0' }];
  }
};

// Send XRP payment
export const sendXRPPayment = async (
  senderWallet: Wallet,
  destinationAddress: string,
  amount: number
): Promise<string> => {
  await connectXRPL();

  const payment: Payment = {
    TransactionType: 'Payment',
    Account: senderWallet.address,
    Destination: destinationAddress,
    Amount: (amount * 1000000).toString(), // Convert to drops
    Memos: [{
      Memo: {
        MemoType: stringToHex('SEND_PAYMENT'),
        MemoData: stringToHex(JSON.stringify({ amount, timestamp: Date.now() }))
      }
    }]
  };

  const response: TxResponse<Payment> = await client.submitAndWait(payment, { wallet: senderWallet });
  return response.result.hash || '';
};

// Send RLUSD payment with automatic trust line creation
export const sendRLUSDPayment = async (
  senderWallet: Wallet,
  destinationAddress: string,
  amount: number
): Promise<string> => {
  await connectXRPL();

  // Check if destination has RLUSD trust line
  const hasTrustLine = await checkTrustLineExists(destinationAddress, 'RLUSD', RLUSD_ISSUER);

  if (!hasTrustLine) {
    throw new Error('Destination account does not have RLUSD trust line. The recipient needs to create a trust line first.');
  }

  const payment: Payment = {
    TransactionType: 'Payment',
    Account: senderWallet.address,
    Destination: destinationAddress,
    Amount: {
      currency: RLUSD_HEX, // Use hex-encoded currency
      issuer: RLUSD_ISSUER,
      value: amount.toString()
    },
    Memos: [{
      Memo: {
        MemoType: stringToHex('RLUSD_PAYMENT'),
        MemoData: stringToHex(JSON.stringify({ amount, timestamp: Date.now() }))
      }
    }]
  };

  const response: TxResponse<Payment> = await client.submitAndWait(payment, { wallet: senderWallet });
  return response.result.hash || '';
};

// Get account transactions
export const getAccountTransactions = async (address: string): Promise<any[]> => {
  await connectXRPL();

  try {
    const response = await client.request({
      command: 'account_tx',
      account: address,
      limit: 10,
      ledger_index_min: -1,
      ledger_index_max: -1
    });

    const transactions = response.result.transactions || [];

    return transactions.map((tx: any) => {
      const transaction = tx.tx || tx;
      const meta = tx.meta;

      // Determine transaction type and details
      let type = 'transaction';
      let amount = 0;
      let description = 'Transaction';

      if (transaction.TransactionType === 'Payment') {
        if (transaction.Destination === address) {
          type = 'received';
          description = 'Payment Received';
        } else {
          type = 'sent';
          description = 'Payment Sent';
        }

        if (typeof transaction.Amount === 'string') {
          amount = parseInt(transaction.Amount) / 1000000; // Convert drops to XRP
        }

        // Check if it's a DID verification transaction
        if (transaction.Memos && transaction.Memos.length > 0) {
          try {
            const memoType = Buffer.from(transaction.Memos[0].Memo.MemoType, 'hex').toString('utf8');
            if (memoType === 'DID_VERIFICATION') {
              type = 'did_verification';
              description = 'DID Verification';
            } else if (memoType === 'LOAN_FUNDING') {
              type = 'loan_funding';
              description = 'Loan Funding';
            } else if (memoType === 'SEND_PAYMENT') {
              type = 'sent';
              description = 'Payment Sent';
            }
          } catch (e) {
            // Ignore memo parsing errors
          }
        }
      } else if (transaction.TransactionType === 'NFTokenMint') {
        type = 'nft_mint';
        description = 'NFT Minted';
      }

      return {
        id: transaction.hash || `${transaction.Account}_${transaction.Sequence}`,
        type,
        amount,
        description,
        hash: transaction.hash,
        date: transaction.date ? new Date((transaction.date + 946684800) * 1000).toLocaleDateString() : 'Recent',
        account: transaction.Account,
        destination: transaction.Destination
      };
    });
  } catch (error) {
    console.error('Could not fetch transactions:', error);
    return [];
  }
};


// Check XRPL network connectivity
const checkXRPLNetworkStatus = async (): Promise<{ isConnected: boolean; ledgerIndex?: number; error?: string }> => {
  try {
    await connectXRPL();
    const serverInfo = await client.request({ command: 'server_info' });
    const ledgerIndex = serverInfo.result.info?.validated_ledger?.seq;

    // Network status check passed

    return {
      isConnected: true,
      ledgerIndex
    };
  } catch (error) {
    console.error('❌ XRPL Network check failed:', error);
    return {
      isConnected: false,
      error: error instanceof Error ? error.message : 'Unknown network error'
    };
  }
};

// Unified DID creation function (handles both Crossmark and seed-based wallets)
export const createDIDTransaction = async (
  walletInfo: XRPLWallet,

  userData: { fullName: string; phone: string }
): Promise<string> => {
  await connectXRPL();

  // Create DID data
  const didData = {
    name: userData.fullName,
    phone: userData.phone,
    timestamp: Date.now(),
    verified: true
  };

  // Determine wallet type and use appropriate method
  const isCrossmarkWallet = !walletInfo.seed || walletInfo.seed.trim() === '';

  if (isCrossmarkWallet) {
    return createDIDWithCrossmark(walletInfo.address, didData);
  } else {
    return createDIDWithSeed(walletInfo.seed, didData);
  }
};

// Crossmark DID creation
const createDIDWithCrossmark = async (address: string, didData: any): Promise<string> => {
  const crossmark = (window as any).crossmark;

  if (!crossmark) {
    throw new Error('Crossmark wallet not found. Please ensure Crossmark extension is installed and active.');
  }

  const transaction = {
    TransactionType: 'AccountSet',
    Account: address,
    Memos: [{
      Memo: {
        MemoType: stringToHex('DID_VERIFICATION'),
        MemoData: stringToHex(JSON.stringify(didData))
      }
    }]
  };

  // Try methods in order of preference
  const methods = ['signAndSubmitAndWait', 'submitAndWait', 'submit'];

  for (const method of methods) {
    if (crossmark.methods?.[method]) {
      try {


        if (method === 'submit') {
          await crossmark.methods[method](transaction);
          await new Promise(resolve => setTimeout(resolve, 3000));
          return await findRecentDIDTransaction(address);
        } else {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT')), 30000);
          });

          const response = await Promise.race([
            crossmark.methods[method](transaction),
            timeoutPromise
          ]);

          return await extractTransactionHash(response, address);
        }
      } catch (error) {
        console.warn(`${method} failed:`, error);
        if (error instanceof Error && !error.message.includes('TIMEOUT')) {
          throw error; // Don't retry on non-timeout errors
        }
        continue; // Try next method on timeout
      }
    }
  }

  throw new Error('No suitable Crossmark methods available. Please update your Crossmark extension.');
};

// Seed-based DID creation
const createDIDWithSeed = async (seed: string, didData: any): Promise<string> => {
  if (!isValidXRPLSeed(seed)) {
    throw new Error('Invalid XRPL seed format.');
  }

  const wallet = createWalletFromSeed(seed);

  const accountSet: AccountSet = {
    TransactionType: 'AccountSet',
    Account: wallet.address,

    Memos: [{
      Memo: {
        MemoType: stringToHex('DID_VERIFICATION'),
        MemoData: stringToHex(JSON.stringify(didData))
      }
    }]
  };

  const response = await client.submitAndWait(accountSet, { wallet, autofill: true });

  if (response.result.validated !== true) {
    throw new Error('Transaction was not validated');
  }

  return response.result.hash || '';
};

// Simplified transaction hash extraction
const extractTransactionHash = async (response: any, address: string): Promise<string> => {
  // Try common hash locations
  const hashPaths = [
    'data.resp.hash',
    'data.resp.result.hash',
    'hash',
    'result.hash'
  ];

  for (const path of hashPaths) {
    const hash = getNestedProperty(response, path);
    if (hash && /^[A-F0-9]{64}$/i.test(hash)) {
      // Verify the hash immediately
      if (await getDIDTransactionByHash(hash)) {
        return hash;
      }
    }
  }

  // Fallback to transaction search
  return await findRecentDIDTransaction(address);
};

// Helper to get nested object properties safely
const getNestedProperty = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Helper function to find recent DID transaction
const findRecentDIDTransaction = async (address: string): Promise<string> => {
  try {
    // Wait for transaction to be processed by the ledger
    await new Promise(resolve => setTimeout(resolve, 5000));

    const recentTxResponse = await client.request({
      command: 'account_tx',
      account: address,
      limit: 10,
      ledger_index_min: -1,
      ledger_index_max: -1
    });

    const transactions = recentTxResponse.result.transactions || [];

    for (const txWrapper of transactions) {
      // Handle different response structures from XRPL
      const transaction = (txWrapper as any).tx_json || (txWrapper as any).tx || (txWrapper as any).transaction || txWrapper;

      // Extract hash from multiple possible locations
      const txHash = transaction?.hash || (txWrapper as any).hash || (txWrapper as any).tx?.hash;

      if (transaction?.TransactionType === 'AccountSet' && transaction?.Memos) {
        const hasDIDMemo = transaction.Memos.some((memo: any) => {
          try {
            const memoType = hexToString(memo.Memo?.MemoType || '');
            return memoType === 'DID_VERIFICATION';
          } catch {
            return false;
          }
        });

        if (hasDIDMemo && txHash && /^[A-F0-9]{64}$/i.test(txHash)) {
          return txHash;
        }
      }
    }

    throw new Error('DID transaction not found in recent transactions');
  } catch (error) {
    throw new Error('Could not find DID transaction. Please check your transaction history.');
  }
};



// Create microloan as NFT
export const createMicroloanNFT = async (
  wallet: Wallet,
  loanData: {
    amount: number;
    purpose: string;
    interestRate: number;
    duration: string;
  }
): Promise<MicroloanNFT> => {
  await connectXRPL();

  const nftMint: NFTokenMint = {
    TransactionType: 'NFTokenMint',
    Account: wallet.address,
    NFTokenTaxon: 0,
    Flags: 8, // tfTransferable flag
    URI: stringToHex(JSON.stringify({
      type: 'microloan',
      ...loanData,
      createdAt: Date.now()
    }))
  };

  const response: TxResponse<NFTokenMint> = await client.submitAndWait(nftMint, { wallet });
  const txHash = response.result.hash || '';

  return {
    nftId: txHash, // Using transaction hash as NFT identifier
    borrower: wallet.address,
    amount: loanData.amount,
    purpose: loanData.purpose,
    interestRate: loanData.interestRate,
    duration: loanData.duration,
    txHash: txHash
  };
};

// Universal NFT creation function that works with both seed-based and Crossmark wallets
export const createMicroloanNFTUniversal = async (
  walletInfo: XRPLWallet,
  loanData: {
    amount: number;
    purpose: string;
    interestRate: number;
    duration: string;
  }
): Promise<MicroloanNFT> => {
  await connectXRPL();

  const nftMint: NFTokenMint = {
    TransactionType: 'NFTokenMint',
    Account: walletInfo.address,
    NFTokenTaxon: 0,
    Flags: 8, // tfTransferable flag
    URI: stringToHex(JSON.stringify({
      type: 'microloan',
      ...loanData,
      createdAt: Date.now()
    }))
  };

  // Check if we have a valid seed for direct wallet access
  if (walletInfo.seed && walletInfo.seed.trim() !== '' && isValidXRPLSeed(walletInfo.seed)) {
    // Use seed-based wallet
    const wallet = createWalletFromSeed(walletInfo.seed);
    const response: TxResponse<NFTokenMint> = await client.submitAndWait(nftMint, { wallet });
    const txHash = response.result.hash || '';

    return {
      nftId: txHash,
      borrower: walletInfo.address,
      amount: loanData.amount,
      purpose: loanData.purpose,
      interestRate: loanData.interestRate,
      duration: loanData.duration,
      txHash: txHash
    };
  } else {
    // Use Crossmark wallet
    return createMicroloanNFTWithCrossmark(walletInfo.address, loanData);
  }
};

// Create NFT using Crossmark
const createMicroloanNFTWithCrossmark = async (
  address: string,
  loanData: {
    amount: number;
    purpose: string;
    interestRate: number;
    duration: string;
  }
): Promise<MicroloanNFT> => {
  const crossmark = (window as any).crossmark;

  if (!crossmark) {
    throw new Error('Crossmark wallet not found. Please ensure Crossmark extension is installed and active.');
  }

  const nftMint = {
    TransactionType: 'NFTokenMint',
    Account: address,
    NFTokenTaxon: 0,
    Flags: 8, // tfTransferable flag
    URI: stringToHex(JSON.stringify({
      type: 'microloan',
      ...loanData,
      createdAt: Date.now()
    }))
  };

  // Try different Crossmark methods
  const methods = ['signAndSubmitAndWait', 'submitAndWait', 'submit'];

  for (const method of methods) {
    if (crossmark.methods?.[method]) {
      try {
        if (method === 'submit') {
          await crossmark.methods[method](nftMint);
          // Wait a bit for transaction to process
          await new Promise(resolve => setTimeout(resolve, 3000));
          const txHash = await findRecentNFTMintTransaction(address);

          return {
            nftId: txHash,
            borrower: address,
            amount: loanData.amount,
            purpose: loanData.purpose,
            interestRate: loanData.interestRate,
            duration: loanData.duration,
            txHash: txHash
          };
        } else {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT')), 30000);
          });

          const response = await Promise.race([
            crossmark.methods[method](nftMint),
            timeoutPromise
          ]);

          const txHash = await extractTransactionHash(response, address);

          return {
            nftId: txHash,
            borrower: address,
            amount: loanData.amount,
            purpose: loanData.purpose,
            interestRate: loanData.interestRate,
            duration: loanData.duration,
            txHash: txHash
          };
        }
      } catch (error) {
        console.warn(`${method} failed:`, error);
        if (error instanceof Error && !error.message.includes('TIMEOUT')) {
          throw error;
        }
        continue;
      }
    }
  }

  throw new Error('No suitable Crossmark methods available for NFT creation. Please update your Crossmark extension.');
};

// Helper function to find recent NFT mint transaction
const findRecentNFTMintTransaction = async (address: string): Promise<string> => {
  await connectXRPL();

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const recentTxResponse = await client.request({
        command: 'account_tx',
        account: address,
        limit: 10,
        ledger_index_min: -1,
        ledger_index_max: -1
      });

      const transactions = recentTxResponse.result.transactions || [];

      for (const txWrapper of transactions) {
        const transaction = (txWrapper as any).tx_json || (txWrapper as any).tx || (txWrapper as any).transaction || txWrapper;

        if (transaction?.TransactionType === 'NFTokenMint') {
          const hash = transaction?.hash || (txWrapper as any).hash || (txWrapper as any).tx?.hash;
          if (hash) {
            return hash;
          }
        }
      }

      // NFT mint transaction not found yet, retrying...
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error in attempt ${attempt + 1}:`, error);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error('Failed to find NFT mint transaction after multiple attempts');
};

// Send RLUSD payment for loan funding with trust line check
export const fundLoanWithRLUSD = async (
  funderWallet: Wallet,
  borrowerAddress: string,
  amount: number,
  loanNFTId?: string
): Promise<string> => {
  await connectXRPL();

  // Check if borrower has RLUSD trust line
  const hasTrustLine = await checkTrustLineExists(borrowerAddress, 'RLUSD', RLUSD_ISSUER);

  if (!hasTrustLine) {
    throw new Error('MISSING_TRUSTLINE');
  }

  // Send RLUSD if trust line exists
  const payment: Payment = {
    TransactionType: 'Payment',
    Account: funderWallet.address,
    Destination: borrowerAddress,
    Amount: {
      currency: RLUSD_HEX, // Use hex-encoded currency
      issuer: RLUSD_ISSUER,
      value: amount.toString()
    },
    Memos: [{
      Memo: {
        MemoType: stringToHex('LOAN_FUNDING_RLUSD'),
        MemoData: stringToHex(JSON.stringify({
          amount,
          loanNFTId: loanNFTId || '',
          timestamp: Date.now()
        }))
      }
    }]
  };

  const response: TxResponse<Payment> = await client.submitAndWait(payment, { wallet: funderWallet });
  return response.result.hash || '';
};

// Universal funding function that works with both Crossmark and seed-based wallets
export const fundLoanWithRLUSDUniversal = async (
  walletInfo: XRPLWallet,
  borrowerAddress: string,
  amount: number,
  loanNFTId?: string
): Promise<string> => {
  await connectXRPL();

  console.log(`🔍 [RLUSD Funding] Starting funding process:`);
  console.log(`🔍 [RLUSD Funding] Funder address: ${walletInfo.address}`);
  console.log(`🔍 [RLUSD Funding] Borrower address: ${borrowerAddress}`);
  console.log(`🔍 [RLUSD Funding] Amount: ${amount}`);
  console.log(`🔍 [RLUSD Funding] Loan NFT ID: ${loanNFTId}`);

  // Check if borrower has RLUSD trust line
  console.log(`🔍 [RLUSD Funding] Checking if borrower has RLUSD trust line...`);
  const hasTrustLine = await checkTrustLineExists(borrowerAddress, 'RLUSD', RLUSD_ISSUER);
  console.log(`🔍 [RLUSD Funding] Trust line check result: ${hasTrustLine}`);

  if (!hasTrustLine) {
    console.log(`❌ [RLUSD Funding] No RLUSD trust line found for borrower: ${borrowerAddress}`);
    throw new Error('MISSING_TRUSTLINE');
  }

  console.log(`✅ [RLUSD Funding] Trust line found, proceeding with payment...`);

  // Create payment transaction
  const payment: Payment = {
    TransactionType: 'Payment',
    Account: walletInfo.address,
    Destination: borrowerAddress,
    Amount: {
      currency: RLUSD_HEX, // Use hex-encoded currency
      issuer: RLUSD_ISSUER,
      value: amount.toString()
    },
    Memos: [{
      Memo: {
        MemoType: stringToHex('LOAN_FUNDING_RLUSD'),
        MemoData: stringToHex(JSON.stringify({
          amount,
          loanNFTId: loanNFTId || '',
          timestamp: Date.now()
        }))
      }
    }]
  };

  // Handle Crossmark vs seed-based wallets
  if (walletInfo.signTransaction && walletInfo.submitTransaction) {
    // Crossmark wallet - use custom sign/submit functions
    return await fundLoanWithCrossmark(walletInfo.address, payment, walletInfo.signTransaction, walletInfo.submitTransaction);
  } else if (walletInfo.seed && walletInfo.seed.trim() !== '') {
    // Seed-based wallet - use traditional method
    return await fundLoanWithSeed(walletInfo.seed, payment);
  } else {
    // Crossmark wallet without sign/submit functions - use global Crossmark
    return await fundLoanWithCrossmarkGlobal(walletInfo.address, payment);
  }
};

// Helper function for Crossmark wallet funding
const fundLoanWithCrossmark = async (
  address: string,
  payment: Payment,
  signTransaction: (tx: any) => Promise<string>,
  submitTransaction: (txBlob: string) => Promise<string>
): Promise<string> => {
  try {
    console.log('🔄 Funding loan with RLUSD using Crossmark wallet...');
    
    // Prepare transaction for Crossmark
    const prepared = await client.autofill(payment);
    console.log('📝 Transaction prepared:', prepared);

    // Sign with Crossmark
    const signedTxBlob = await signTransaction(prepared);
    console.log('✅ Transaction signed with Crossmark');

    // Submit with Crossmark
    const txHash = await submitTransaction(signedTxBlob);
    console.log('🚀 Transaction submitted:', txHash);

    return txHash;
  } catch (error) {
    console.error('❌ Crossmark RLUSD funding failed:', error);
    throw error;
  }
};

// Helper function for Crossmark wallet funding using global Crossmark object
const fundLoanWithCrossmarkGlobal = async (address: string, payment: Payment): Promise<string> => {
  try {
    console.log('🔄 Funding loan with RLUSD using global Crossmark...');
    
    const crossmark = (window as any).crossmark;
    if (!crossmark) {
      throw new Error('Crossmark wallet not found. Please ensure Crossmark extension is installed and active.');
    }

    // Try different Crossmark methods
    const methods = ['signAndSubmitAndWait', 'submitAndWait', 'submit'];

    for (const method of methods) {
      if (crossmark.methods?.[method]) {
        try {
          console.log(`🔄 Trying Crossmark method: ${method}`);
          
          if (method === 'submit') {
            await crossmark.methods[method](payment);
            // Wait a bit for transaction to process
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Find the recent transaction by looking for payments from this address
            const recentTxResponse = await client.request({
              command: 'account_tx',
              account: address,
              limit: 10,
              ledger_index_min: -1,
              ledger_index_max: -1
            });

            const transactions = recentTxResponse.result.transactions || [];
            for (const txWrapper of transactions) {
              const transaction = (txWrapper as any).tx_json || (txWrapper as any).tx || txWrapper;
              if (transaction?.TransactionType === 'Payment' && 
                  transaction?.Account === address &&
                  transaction?.hash) {
                console.log('🚀 Found recent payment transaction:', transaction.hash);
                return transaction.hash;
              }
            }
            
            throw new Error('Transaction submitted but hash not found');
          } else {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('TIMEOUT')), 30000);
            });

            const response = await Promise.race([
              crossmark.methods[method](payment),
              timeoutPromise
            ]);

            console.log('📝 Crossmark response:', response);
            console.log('📝 Response type:', typeof response);
            console.log('📝 Response keys:', response ? Object.keys(response) : 'No response');
            
            // Extract transaction hash from various response formats
            let txHash = '';
            if (response?.hash) {
              txHash = response.hash;
            } else if (response?.response?.hash) {
              txHash = response.response.hash;
            } else if (response?.result?.hash) {
              txHash = response.result.hash;
            } else if (response?.tx_json?.hash) {
              txHash = response.tx_json.hash;
            } else if (response?.tx?.hash) {
              txHash = response.tx.hash;
            } else if (response?.transaction?.hash) {
              txHash = response.transaction.hash;
            } else if (typeof response === 'string' && response.length === 64) {
              // Sometimes Crossmark returns just the hash as a string
              txHash = response;
            }

            if (txHash) {
              console.log('🚀 RLUSD funding transaction hash:', txHash);
              return txHash;
            } else {
              console.log('❌ No hash found, will search for recent transaction...');
              // Fallback: search for recent transaction from this address
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
              
              const recentTxResponse = await client.request({
                command: 'account_tx',
                account: address,
                limit: 5,
                ledger_index_min: -1,
                ledger_index_max: -1
              });

              const transactions = recentTxResponse.result.transactions || [];
              console.log('🔍 Looking for recent transactions:', transactions.length);
              
              for (const txWrapper of transactions) {
                const transaction = (txWrapper as any).tx_json || (txWrapper as any).tx || txWrapper;
                console.log('🔍 Checking transaction:', transaction?.TransactionType, transaction?.hash);
                
                if (transaction?.TransactionType === 'Payment' && 
                    transaction?.Account === address &&
                    transaction?.hash) {
                  console.log('🎯 Found recent RLUSD payment transaction:', transaction.hash);
                  return transaction.hash;
                }
              }
              
              throw new Error('Transaction likely succeeded but hash could not be retrieved. Check your transaction history.');
            }
          }
        } catch (error) {
          console.warn(`${method} failed:`, error);
          if (error instanceof Error && !error.message.includes('TIMEOUT')) {
            throw error; // Don't retry on non-timeout errors
          }
          continue; // Try next method on timeout
        }
      }
    }

    throw new Error('No suitable Crossmark methods available for RLUSD funding. Please update your Crossmark extension.');
  } catch (error) {
    console.error('❌ Crossmark global RLUSD funding failed:', error);
    throw error;
  }
};

// Helper function for seed-based wallet funding
const fundLoanWithSeed = async (seed: string, payment: Payment): Promise<string> => {
  try {
    console.log('🔄 Funding loan with RLUSD using seed-based wallet...');
    
    const wallet = createWalletFromSeed(seed);
    const response: TxResponse<Payment> = await client.submitAndWait(payment, { wallet });
    const txHash = response.result.hash || '';
    
    console.log('🚀 RLUSD funding transaction hash:', txHash);
    return txHash;
  } catch (error) {
    console.error('❌ Seed-based RLUSD funding failed:', error);
    throw error;
  }
};

export const fundLoanWithXRP = async (
  funderWallet: Wallet,
  borrowerAddress: string,
  amount: number,
  loanNFTId: string // Pass the NFT ID for the memo
): Promise<string> => {
  await connectXRPL();

  const payment: Payment = {
    TransactionType: 'Payment',
    Account: funderWallet.address,
    Destination: borrowerAddress,
    Amount: (amount * 1000000).toString(), // XRP to drops
    Memos: [{
      Memo: {
        MemoType: stringToHex('LOAN_FUNDING_XRP'),
        MemoData: stringToHex(JSON.stringify({
          amount,
          loanNFTId,
          timestamp: Date.now(),
          note: 'Funded with XRP as fallback due to missing RLUSD trust line'
        }))
      }
    }]
  };
  const response: TxResponse<Payment> = await client.submitAndWait(payment, { wallet: funderWallet });
  return response.result.hash || '';
};

// Universal XRP funding function that works with both Crossmark and seed-based wallets
export const fundLoanWithXRPUniversal = async (
  walletInfo: XRPLWallet,
  borrowerAddress: string,
  amount: number,
  loanNFTId: string
): Promise<string> => {
  await connectXRPL();

  // Create payment transaction
  const payment: Payment = {
    TransactionType: 'Payment',
    Account: walletInfo.address,
    Destination: borrowerAddress,
    Amount: (amount * 1000000).toString(), // XRP to drops
    Memos: [{
      Memo: {
        MemoType: stringToHex('LOAN_FUNDING_XRP'),
        MemoData: stringToHex(JSON.stringify({
          amount,
          loanNFTId,
          timestamp: Date.now(),
          note: 'Funded with XRP as fallback due to missing RLUSD trust line'
        }))
      }
    }]
  };

  // Handle Crossmark vs seed-based wallets
  if (walletInfo.signTransaction && walletInfo.submitTransaction) {
    // Crossmark wallet - use custom sign/submit functions
    return await fundXRPWithCrossmark(walletInfo.address, payment, walletInfo.signTransaction, walletInfo.submitTransaction);
  } else if (walletInfo.seed && walletInfo.seed.trim() !== '') {
    // Seed-based wallet - use traditional method
    return await fundXRPWithSeed(walletInfo.seed, payment);
  } else {
    // Crossmark wallet without sign/submit functions - use global Crossmark
    return await fundXRPWithCrossmarkGlobal(walletInfo.address, payment);
  }
};

// Helper function for Crossmark wallet XRP funding
const fundXRPWithCrossmark = async (
  address: string,
  payment: Payment,
  signTransaction: (tx: any) => Promise<string>,
  submitTransaction: (txBlob: string) => Promise<string>
): Promise<string> => {
  try {
    console.log('🔄 Funding loan with XRP using Crossmark wallet...');
    
    // Prepare transaction for Crossmark
    const prepared = await client.autofill(payment);
    console.log('📝 Transaction prepared:', prepared);

    // Sign with Crossmark
    const signedTxBlob = await signTransaction(prepared);
    console.log('✅ Transaction signed with Crossmark');

    // Submit with Crossmark
    const txHash = await submitTransaction(signedTxBlob);
    console.log('🚀 Transaction submitted:', txHash);

    return txHash;
  } catch (error) {
    console.error('❌ Crossmark XRP funding failed:', error);
    throw error;
  }
};

// Helper function for Crossmark wallet XRP funding using global Crossmark object
const fundXRPWithCrossmarkGlobal = async (address: string, payment: Payment): Promise<string> => {
  try {
    console.log('🔄 Funding loan with XRP using global Crossmark...');
    
    const crossmark = (window as any).crossmark;
    if (!crossmark) {
      throw new Error('Crossmark wallet not found. Please ensure Crossmark extension is installed and active.');
    }

    // Try different Crossmark methods
    const methods = ['signAndSubmitAndWait', 'submitAndWait', 'submit'];

    for (const method of methods) {
      if (crossmark.methods?.[method]) {
        try {
          console.log(`🔄 Trying Crossmark method: ${method}`);
          
          if (method === 'submit') {
            await crossmark.methods[method](payment);
            // Wait a bit for transaction to process
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Find the recent transaction by looking for payments from this address
            const recentTxResponse = await client.request({
              command: 'account_tx',
              account: address,
              limit: 10,
              ledger_index_min: -1,
              ledger_index_max: -1
            });

            const transactions = recentTxResponse.result.transactions || [];
            for (const txWrapper of transactions) {
              const transaction = (txWrapper as any).tx_json || (txWrapper as any).tx || txWrapper;
              if (transaction?.TransactionType === 'Payment' && 
                  transaction?.Account === address &&
                  transaction?.hash) {
                console.log('🚀 Found recent XRP payment transaction:', transaction.hash);
                return transaction.hash;
              }
            }
            
            throw new Error('Transaction submitted but hash not found');
          } else {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('TIMEOUT')), 30000);
            });

            const response = await Promise.race([
              crossmark.methods[method](payment),
              timeoutPromise
            ]);

            console.log('📝 Crossmark XRP response:', response);
            console.log('📝 Response type:', typeof response);
            console.log('📝 Response keys:', response ? Object.keys(response) : 'No response');
            
            // Extract transaction hash from various response formats
            let txHash = '';
            if (response?.hash) {
              txHash = response.hash;
            } else if (response?.response?.hash) {
              txHash = response.response.hash;
            } else if (response?.result?.hash) {
              txHash = response.result.hash;
            } else if (response?.tx_json?.hash) {
              txHash = response.tx_json.hash;
            } else if (response?.tx?.hash) {
              txHash = response.tx.hash;
            } else if (response?.transaction?.hash) {
              txHash = response.transaction.hash;
            } else if (typeof response === 'string' && response.length === 64) {
              // Sometimes Crossmark returns just the hash as a string
              txHash = response;
            }

            if (txHash) {
              console.log('🚀 XRP funding transaction hash:', txHash);
              return txHash;
            } else {
              console.log('❌ No hash found, will search for recent transaction...');
              // Fallback: search for recent transaction from this address
              console.log('⏰ Waiting 4 seconds for transaction to be processed...');
              await new Promise(resolve => setTimeout(resolve, 4000)); // Wait 4 seconds (increased)
              
              console.log('🔍 Searching for recent transactions from address:', address);
              const recentTxResponse = await client.request({
                command: 'account_tx',
                account: address,
                limit: 10, // Increased limit
                ledger_index_min: -1,
                ledger_index_max: -1
              });

              const transactions = recentTxResponse.result.transactions || [];
              console.log('🔍 Found', transactions.length, 'recent transactions');
              
              // Log all transactions for debugging
              transactions.forEach((txWrapper, index) => {
                const transaction = (txWrapper as any).tx_json || (txWrapper as any).tx || txWrapper;
                console.log(`Transaction ${index}:`, {
                  type: transaction?.TransactionType,
                  account: transaction?.Account,
                  hash: transaction?.hash,
                  date: transaction?.date,
                  amount: transaction?.Amount,
                  destination: transaction?.Destination
                });
              });
              
              // Look for ANY recent payment transaction from this address
              for (const txWrapper of transactions) {
                const transaction = (txWrapper as any).tx_json || (txWrapper as any).tx || txWrapper;
                
                if (transaction?.TransactionType === 'Payment' && 
                    transaction?.Account === address &&
                    transaction?.hash) {
                  console.log('🎯 Found recent XRP payment transaction:', transaction.hash);
                  return transaction.hash;
                }
              }
              
              // If still not found, return a placeholder and let the user know
              console.log('⚠️ Could not find transaction hash, but transaction likely succeeded');
              return 'TRANSACTION_SUCCEEDED_BUT_HASH_UNKNOWN';
            }
          }
        } catch (error) {
          console.warn(`${method} failed:`, error);
          if (error instanceof Error && !error.message.includes('TIMEOUT')) {
            throw error; // Don't retry on non-timeout errors
          }
          continue; // Try next method on timeout
        }
      }
    }

    throw new Error('No suitable Crossmark methods available for XRP funding. Please update your Crossmark extension.');
  } catch (error) {
    console.error('❌ Crossmark global XRP funding failed:', error);
    throw error;
  }
};

// Helper function for seed-based wallet XRP funding
const fundXRPWithSeed = async (seed: string, payment: Payment): Promise<string> => {
  try {
    console.log('🔄 Funding loan with XRP using seed-based wallet...');
    
    const wallet = createWalletFromSeed(seed);
    const response: TxResponse<Payment> = await client.submitAndWait(payment, { wallet });
    const txHash = response.result.hash || '';
    
    console.log('🚀 XRP funding transaction hash:', txHash);
    return txHash;
  } catch (error) {
    console.error('❌ Seed-based XRP funding failed:', error);
    throw error;
  }
};

// Get account NFTs
export const getAccountNFTs = async (address: string): Promise<any[]> => {
  await connectXRPL();

  try {
    const response = await client.request({
      command: 'account_nfts',
      account: address
    });
    return response.result.account_nfts || [];
  } catch (error) {
    console.warn('Could not fetch NFTs:', error);
    return [];
  }
};

// Trust Score interface
export interface TrustScore {
  score: number;
  risk: 'low' | 'medium' | 'high';
  factors: {
    hasDID: boolean;
    transactionCount: number;
    accountAge?: number;
  };
}

// Calculate Trust Score based on on-chain activity
export const calculateTrustScore = async (address: string): Promise<TrustScore> => {
  await connectXRPL();

  try {

    // Fetch account transactions to analyze
    const transactionsResponse = await client.request({
      command: 'account_tx',
      account: address,
      limit: 100, // Get last 100 transactions for analysis
      ledger_index_min: -1,
      ledger_index_max: -1
    });

    const transactions = transactionsResponse.result.transactions || [];
    let score = 0;
    let hasDID = false;
    const transactionCount = transactions.length;

    // Check for DID verification in multiple ways (+10 points)
    // 1. Check for AccountSet transactions with DID_VERIFICATION memo (new method)
    // 2. Check for Payment transactions with DID_VERIFICATION memo (old method)
    // 3. Check account domain for microlend.did
    let didTransaction = transactions.find((tx: any) => {

      // Handle different response structures from XRPL
      const transaction = tx.tx_json || tx.tx || tx.transaction || tx;
      const txType = transaction?.TransactionType;
      const memos = transaction?.Memos || [];

      // Check for DID verification memo in AccountSet or Payment transactions
      const hasDIDMemo = memos.some((memo: any) => {
        try {
          const memoType = memo.Memo?.MemoType;
          if (memoType) {
            const decodedType = hexToString(memoType);
            return decodedType === 'DID_VERIFICATION';
          }
          return false;
        } catch {
          return false;
        }
      });

      return (txType === 'AccountSet' || txType === 'Payment') && hasDIDMemo;
    });


    // Add points for transaction history (+1 per 10 transactions, max +20)
    const transactionPoints = Math.min(Math.floor(transactionCount / 10), 20);
    score += transactionPoints;

    // Try to get account info for DID domain check and account age
    let accountAge: number | undefined;
    let hasDomainDID = false;

    try {
      const accountInfo = await client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated'
      });

      // Check for microlend domain (DID verification)
      const domain = accountInfo.result.account_data.Domain;
      if (domain) {
        const decodedDomain = hexToString(domain);
        if (decodedDomain === 'microlend.did') {
          hasDomainDID = true;
        }
      }

      // Calculate approximate account age based on sequence number
      const sequence = accountInfo.result.account_data.Sequence || 0;
      if (sequence > 0) {
        accountAge = sequence; // Store sequence as proxy for age
        // Small bonus for older accounts (up to +5 points)
        const ageBonus = Math.min(Math.floor(sequence / 50), 5);
        score += ageBonus;
      }
    } catch (error) {
      // Account info not available - continue without age bonus
    }

    // Final DID check - either transaction-based or domain-based
    if (didTransaction || hasDomainDID) {
      hasDID = true;
      score += 10;
    }

    // Determine risk level after all calculations
    let risk: 'low' | 'medium' | 'high';
    if (score > 20) {
      risk = 'low';
    } else if (score >= 10) {
      risk = 'medium';
    } else {
      risk = 'high';
    }

    return {
      score,
      risk,
      factors: {
        hasDID,
        transactionCount,
        accountAge
      }
    };
  } catch (error) {
    console.error('Could not calculate trust score:', error);
    // Return default low trust score on error
    return {
      score: 0,
      risk: 'high',
      factors: {
        hasDID: false,
        transactionCount: 0
      }
    };
  }
};

// Close XRPL connection
export const disconnectXRPL = async (): Promise<void> => {
  if (client.isConnected()) {
    await client.disconnect();
  }
};



// Function to retrieve DID data from the most recent DID transaction
export const getCurrentDIDData = async (address: string): Promise<{ name: string; phone: string; timestamp: number } | null> => {
  try {
    await connectXRPL();

    const recentTxResponse = await client.request({
      command: 'account_tx',
      account: address,
      limit: 50, // Check more transactions to find the most recent DID
      ledger_index_min: -1,
      ledger_index_max: -1
    });

    const transactions = recentTxResponse.result.transactions || [];

    for (const txWrapper of transactions) {
      const transaction = (txWrapper as any).tx_json || (txWrapper as any).tx || (txWrapper as any).transaction || txWrapper;

      if (transaction?.TransactionType === 'AccountSet' && transaction?.Memos) {
        const didMemo = transaction.Memos.find((memo: any) => {
          try {
            const memoType = hexToString(memo.Memo?.MemoType || '');
            return memoType === 'DID_VERIFICATION';
          } catch {
            return false;
          }
        });

        if (didMemo?.Memo?.MemoData) {
          try {
            const didData = JSON.parse(hexToString(didMemo.Memo.MemoData));
            return {
              name: didData.name || '',
              phone: didData.phone || '',
              timestamp: didData.timestamp || 0
            };
          } catch {
            continue; // Skip malformed data, continue searching
          }
        }
      }
    }

    return null; // No DID data found
  } catch (error) {
    return null;
  }
};

// Function to verify existing DID transaction by hash
export const getDIDTransactionByHash = async (txHash: string): Promise<boolean> => {
  try {
    await connectXRPL();

    // Validate hash format
    if (!/^[A-F0-9]{64}$/i.test(txHash)) {
      return false;
    }

    // Get transaction details
    const txResponse = await client.request({
      command: 'tx',
      transaction: txHash,
      binary: false
    });

    const txResult = txResponse.result as any;
    const transaction = txResult.tx_json || txResult;

    // Check if it's a validated AccountSet transaction with DID memo
    if (txResult.validated !== true || transaction.TransactionType !== 'AccountSet') {
      return false;
    }

    // Check for DID verification memo
    const memos = transaction.Memos || [];
    const hasDIDMemo = memos.some((memo: any) => {
      try {
        const memoType = hexToString(memo.Memo?.MemoType || '');
        return memoType === 'DID_VERIFICATION';
      } catch {
        return false;
      }
    });

    return hasDIDMemo;

  } catch (error) {
    return false;
  }
};

// Function to apply/activate existing DID for loan NFT creation
export const applyDIDForLoans = async (address: string, walletSeed?: string): Promise<string> => {
  try {
    await connectXRPL();

    // First, verify that a DID exists
    const existingDID = await getCurrentDIDData(address);
    if (!existingDID) {
      throw new Error('No existing DID found. Please create a DID first.');
    }

    // Check if we have a Crossmark wallet or seed-based wallet
    const crossmark = (window as any).crossmark;

    // For Crossmark wallets, we detect them by having no seed and Crossmark being available
    const isCrossmarkWallet = !walletSeed && crossmark;

    // Prioritize Crossmark wallet if available, then fall back to seed-based
    if (isCrossmarkWallet) {
      return applyDIDWithCrossmark(address, existingDID);
    } else if (walletSeed && walletSeed.trim() !== '') {
      return applyDIDWithSeed(walletSeed, existingDID);
    } else {
      throw new Error('No valid wallet method available. Please ensure you have either Crossmark connected or a valid seed.');
    }
  } catch (error) {
    console.error('Failed to apply DID for loans:', error);
    throw error;
  }
};

// Apply DID using Crossmark
const applyDIDWithCrossmark = async (address: string, didData: any): Promise<string> => {
  const crossmark = (window as any).crossmark;

  if (!crossmark) {
    throw new Error('Crossmark wallet not found. Please ensure Crossmark extension is installed and active.');
  }

  // Create a loan application transaction that references the existing DID
  const loanApplicationData = {
    type: 'LOAN_DID_APPLICATION',
    didTimestamp: didData.timestamp,
    name: didData.name,
    phone: didData.phone,
    appliedAt: Date.now(),
    purpose: 'Enable loan NFT creation with verified DID'
  };

  const transaction = {
    TransactionType: 'AccountSet',
    Account: address,
    Memos: [{
      Memo: {
        MemoType: stringToHex('LOAN_DID_APPLICATION'),
        MemoData: stringToHex(JSON.stringify(loanApplicationData))
      }
    }]
  };

  // Try methods in order of preference
  const methods = ['signAndSubmitAndWait', 'submitAndWait', 'submit'];

  for (const method of methods) {
    if (crossmark.methods?.[method]) {
      try {


        if (method === 'submit') {
          await crossmark.methods[method](transaction);
          await new Promise(resolve => setTimeout(resolve, 3000));
          return await findRecentLoanApplicationTransaction(address);
        } else {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('TIMEOUT')), 30000);
          });

          const response = await Promise.race([
            crossmark.methods[method](transaction),
            timeoutPromise
          ]);

          return await extractTransactionHash(response, address);
        }
      } catch (error) {
        console.warn(`${method} failed:`, error);
        if (error instanceof Error && !error.message.includes('TIMEOUT')) {
          throw error;
        }
        continue;
      }
    }
  }

  throw new Error('No suitable Crossmark methods available. Please update your Crossmark extension.');
};

// Apply DID using seed-based wallet
const applyDIDWithSeed = async (seed: string, didData: any): Promise<string> => {
  if (!isValidXRPLSeed(seed)) {
    throw new Error('Invalid XRPL seed format.');
  }

  const wallet = createWalletFromSeed(seed);

  // Create a loan application transaction that references the existing DID
  const loanApplicationData = {
    type: 'LOAN_DID_APPLICATION',
    didTimestamp: didData.timestamp,
    name: didData.name,
    phone: didData.phone,
    appliedAt: Date.now(),
    purpose: 'Enable loan NFT creation with verified DID'
  };

  const accountSet: AccountSet = {
    TransactionType: 'AccountSet',
    Account: wallet.address,
    Memos: [{
      Memo: {
        MemoType: stringToHex('LOAN_DID_APPLICATION'),
        MemoData: stringToHex(JSON.stringify(loanApplicationData))
      }
    }]
  };

  const response = await client.submitAndWait(accountSet, { wallet, autofill: true });

  if (response.result.validated !== true) {
    throw new Error('Transaction was not validated');
  }

  return response.result.hash || '';
};

// Helper function to find recent loan application transaction
const findRecentLoanApplicationTransaction = async (address: string): Promise<string> => {
  await connectXRPL();

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const recentTxResponse = await client.request({
        command: 'account_tx',
        account: address,
        limit: 10,
        ledger_index_min: -1,
        ledger_index_max: -1
      });

      const transactions = recentTxResponse.result.transactions || [];

      for (const txWrapper of transactions) {
        const transaction = (txWrapper as any).tx_json || (txWrapper as any).tx || (txWrapper as any).transaction || txWrapper;

        if (transaction?.TransactionType === 'AccountSet' && transaction?.Memos) {
          const loanAppMemo = transaction.Memos.find((memo: any) => {
            try {
              const memoType = hexToString(memo.Memo?.MemoType || '');
              return memoType === 'LOAN_DID_APPLICATION';
            } catch {
              return false;
            }
          });

          if (loanAppMemo) {
            const hash = transaction?.hash || (txWrapper as any).hash || (txWrapper as any).tx?.hash;
            if (hash) {
              return hash;
            }
          }
        }
      }

      // Transaction not found yet, retrying...
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error in attempt ${attempt + 1}:`, error);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error('Failed to find loan application transaction after multiple attempts');
};

// Function to check if DID has been applied for loans
export const isDIDAppliedForLoans = async (address: string): Promise<boolean> => {
  try {
    await connectXRPL();

    const recentTxResponse = await client.request({
      command: 'account_tx',
      account: address,
      limit: 50,
      ledger_index_min: -1,
      ledger_index_max: -1
    });

    const transactions = recentTxResponse.result.transactions || [];

    // First check for explicit loan application
    for (const txWrapper of transactions) {
      const transaction = (txWrapper as any).tx_json || (txWrapper as any).tx || (txWrapper as any).transaction || txWrapper;

      if (transaction?.TransactionType === 'AccountSet' && transaction?.Memos) {
        const loanAppMemo = transaction.Memos.find((memo: any) => {
          try {
            const memoType = hexToString(memo.Memo?.MemoType || '');
            return memoType === 'LOAN_DID_APPLICATION';
          } catch {
            return false;
          }
        });

        if (loanAppMemo) {
          return true;
        }
      }
    }

    // If no explicit loan application found, check if user has a DID
    // If they have a DID, automatically consider them eligible for loans
    const hasDID = await getCurrentDIDData(address);
    if (hasDID) {
      console.log('User has DID but no explicit loan application - auto-enabling NFT creation');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking DID loan application:', error);
    return false;
  }
};
