import { Client, Wallet, NFTokenMint, Payment, TxResponse, TrustSet, AccountSet } from 'xrpl';

// XRPL Client setup for Testnet
const client = new Client('wss://s.altnet.rippletest.net:51233');

// DID Creation Functions:
// - createDIDTransactionSmart: Auto-detects wallet type and uses appropriate method
// - createDIDTransactionWithCrossmark: For Crossmark wallets (no seed available)
// - createDIDTransaction: For seed-based wallets (has private key access)

export interface XRPLWallet {
  address: string;
  seed: string;
  balance: string;
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
const RLUSD_ISSUER = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De';

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
    console.log('✅ Successfully created wallet from seed:', wallet.address);
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
      currency: 'RLUSD',
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
    const response = await client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated'
    });

    const lines = response.result.lines || [];
    return lines.some((line: any) => 
      line.currency === currency && line.account === issuer
    );
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
    console.log('Funding wallet:', wallet.address);
    await client.fundWallet(wallet);
  } catch (error) {
    console.log('Wallet funding might have failed, but wallet created:', error);
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
      console.log(`Could not fetch balance, retries left: ${retries - 1}`, error);
      retries--;
      if (retries === 0) {
        console.log('Using default balance of 0');
      }
    }
  }
  
  // Validate the generated seed before returning
  if (!wallet.seed) {
    throw new Error('Failed to generate wallet seed');
  }
  
  console.log('Generated wallet with seed length:', wallet.seed.length);
  console.log('Seed starts with:', wallet.seed.substring(0, 5));
  
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
      currency: 'RLUSD',
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
    
    console.log('🌐 XRPL Network Status:', {
      connected: client.isConnected(),
      ledgerIndex,
      networkId: serverInfo.result.info?.network_id
    });
    
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

  console.log('🔍 Creating DID transaction for:', walletInfo.address);
  
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
        console.log(`🔄 Trying ${method}...`);
        
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
        console.log(`❌ ${method} failed:`, error);
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
      console.log(`✅ Found valid hash at ${path}:`, hash);
      
      // Verify the hash immediately
      if (await getDIDTransactionByHash(hash)) {
        return hash;
      }
    }
  }
  
  // Fallback to transaction search
  console.log('🔍 No valid hash found, searching recent transactions...');
  return await findRecentDIDTransaction(address);
};

// Helper to get nested object properties safely
const getNestedProperty = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Helper function to find recent DID transaction
const findRecentDIDTransaction = async (address: string): Promise<string> => {
  try {
    console.log('🔍 Searching for recent DID transaction...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const recentTxResponse = await client.request({
      command: 'account_tx',
      account: address,
      limit: 10,
      ledger_index_min: -1,
      ledger_index_max: -1
    });
    
    const transactions = recentTxResponse.result.transactions || [];
    
    for (const txWrapper of transactions) {
      const transaction = (txWrapper as any).tx || (txWrapper as any).transaction || txWrapper;
      
      if (transaction?.TransactionType === 'AccountSet' && transaction?.Memos) {
        const hasDIDMemo = transaction.Memos.some((memo: any) => {
          try {
            const memoType = hexToString(memo.Memo?.MemoType || '');
            return memoType === 'DID_VERIFICATION';
          } catch {
            return false;
          }
        });
        
        if (hasDIDMemo && transaction.hash && /^[A-F0-9]{64}$/i.test(transaction.hash)) {
          console.log('✅ Found DID transaction:', transaction.hash);
          return transaction.hash;
        }
      }
    }
    
    throw new Error('DID transaction not found in recent transactions');
  } catch (error) {
    throw new Error('Could not find DID transaction. Please check your transaction history.');
  }
};

// Smart DID creation function that automatically chooses the right method
export const createDIDTransactionSmart = async (
  walletInfo: XRPLWallet, 
  userData: { fullName: string; phone: string }
): Promise<string> => {
  // Use the new unified function
  return createDIDTransaction(walletInfo, userData);
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
      currency: 'RLUSD',
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
    console.log('Could not fetch NFTs:', error);
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
    console.log('🔍 Calculating Trust Score for address:', address);
    
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
    
    console.log('📊 Found', transactionCount, 'transactions');

    // Check for DID verification in multiple ways (+10 points)
    // 1. Check for AccountSet transactions with DID_VERIFICATION memo (new method)
    // 2. Check for Payment transactions with DID_VERIFICATION memo (old method)
    // 3. Check account domain for microlend.did
    let didTransaction = transactions.find((tx: any) => {
      const txType = tx.tx?.TransactionType;
      const memos = tx.tx?.Memos || [];
      
      console.log('🔍 Checking transaction type:', txType, 'with', memos.length, 'memos');
      
      // Check for DID verification memo in AccountSet or Payment transactions
      const hasDIDMemo = memos.some((memo: any) => {
        try {
          const memoType = memo.Memo?.MemoType;
          if (memoType) {
            const decodedType = hexToString(memoType);
            console.log('📝 Found memo type:', decodedType);
            return decodedType === 'DID_VERIFICATION';
          }
          return false;
        } catch {
          return false;
        }
      });
      
      if ((txType === 'AccountSet' || txType === 'Payment') && hasDIDMemo) {
        console.log('✅ Found DID transaction:', txType, 'with DID memo');
        return true;
      }
      
      return false;
    });
    
    console.log('🔍 DID transaction found in history:', !!didTransaction);

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
      console.log('🌐 Account domain:', domain);
      if (domain) {
        const decodedDomain = hexToString(domain);
        console.log('🌐 Decoded domain:', decodedDomain);
        if (decodedDomain === 'microlend.did') {
          hasDomainDID = true;
          console.log('✅ Domain-based DID found!');
        }
      }
      
      // Calculate approximate account age based on sequence number
      const sequence = accountInfo.result.account_data.Sequence || 0;
      console.log('📅 Account sequence:', sequence);
      if (sequence > 0) {
        accountAge = sequence; // Store sequence as proxy for age
        // Small bonus for older accounts (up to +5 points)
        const ageBonus = Math.min(Math.floor(sequence / 50), 5);
        console.log('🎁 Age bonus:', ageBonus);
        score += ageBonus;
      }
    } catch (error) {
      console.log('Could not fetch account info:', error);
    }

    // Final DID check - either transaction-based or domain-based
    if (didTransaction || hasDomainDID) {
      hasDID = true;
      score += 10;
      console.log('✅ DID verified! Adding 10 points. New score:', score);
    } else {
      console.log('❌ No DID found. Score remains:', score);
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

    console.log('🎯 Final Trust Score:', {
      score,
      risk,
      factors: { hasDID, transactionCount, accountAge }
    });

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

// Comprehensive diagnostic function (combines testing and diagnostics)
export const diagnoseCrossmarkDID = async (address: string): Promise<{ 
  canCreateDID: boolean; 
  issues: string[]; 
  recommendations: string[];
  preferredMethod?: string;
  availableMethods: string[];
}> => {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let availableMethods: string[] = [];
  let preferredMethod = '';
  
  try {
    // Test Crossmark availability and methods
    const crossmark = (window as any).crossmark;
    
    if (!crossmark) {
      issues.push('Crossmark extension not found');
      recommendations.push('Install Crossmark extension from crossmark.io');
      return { canCreateDID: false, issues, recommendations, availableMethods };
    }

    availableMethods = Object.keys(crossmark.methods || {});
    
    // Determine preferred method
    if (availableMethods.includes('signAndSubmitAndWait')) {
      preferredMethod = 'signAndSubmitAndWait';
    } else if (availableMethods.includes('submitAndWait')) {
      preferredMethod = 'submitAndWait';
      issues.push('Optimal method not available');
      recommendations.push('Update Crossmark extension for better performance');
    } else if (availableMethods.includes('submit')) {
      preferredMethod = 'submit';
      issues.push('Only basic methods available');
      recommendations.push('Update Crossmark extension for better transaction support');
    } else {
      issues.push('No transaction methods found');
      recommendations.push('Reinstall Crossmark extension');
    }

    // Test connectivity
    try {
      if (crossmark.methods?.getAddress) {
        await crossmark.methods.getAddress();
      }
    } catch (error) {
      issues.push('Crossmark connectivity failed');
      recommendations.push('Unlock Crossmark and reconnect wallet');
    }
    
    // Check XRPL connection
    await connectXRPL();
    if (!client.isConnected()) {
      issues.push('XRPL network connection failed');
      recommendations.push('Check internet connection');
    }
    
    // Check existing DID
    const trustScore = await calculateTrustScore(address);
    if (trustScore.factors.hasDID) {
      issues.push('DID already exists');
      recommendations.push('DID verification already completed');
      return { canCreateDID: false, issues, recommendations, preferredMethod, availableMethods };
    }
    
    // Check balance
    const balances = await getAccountBalances(address);
    const xrpBalance = parseFloat(balances.find(b => b.currency === 'XRP')?.value || '0');
    
    if (xrpBalance < 1) {
      issues.push('Insufficient XRP balance');
      recommendations.push('Add at least 1 XRP for transaction fees');
    }
    
    // Final assessment
    const canCreateDID = !issues.some(issue => 
      issue.includes('Insufficient XRP') || 
      issue.includes('XRPL network') ||
      issue.includes('DID already exists') ||
      issue.includes('No transaction methods')
    );
    
    if (canCreateDID) {
      recommendations.push(`Ready to create DID using ${preferredMethod}`);
    }
    
    return { canCreateDID, issues, recommendations, preferredMethod, availableMethods };
    
  } catch (error) {
    issues.push(`Diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    recommendations.push('Refresh page and try again');
    return { canCreateDID: false, issues, recommendations, preferredMethod, availableMethods };
  }
};

// Fallback DID creation using simple payment method
export const createDIDWithSimplePayment = async (
  address: string, 
  userData: { fullName: string; phone: string }
): Promise<string> => {
  await connectXRPL();

  const crossmark = (window as any).crossmark;
  
  if (!crossmark) {
    throw new Error('Crossmark wallet not found.');
  }

  console.log('🔄 Using simple payment fallback method for DID creation');

  // Create DID data
  const didData = {
    name: userData.fullName,
    phone: userData.phone,
    timestamp: Date.now(),
    verified: true,
    method: 'simple_payment_fallback'
  };

  try {
    // Simple self-payment with DID memo (minimal amount)
    const paymentTx = {
      TransactionType: 'Payment',
      Account: address,
      Destination: address,
      Amount: '1', // 1 drop (0.000001 XRP)
      Memos: [{
        Memo: {
          MemoType: stringToHex('DID_VERIFICATION'),
          MemoData: stringToHex(JSON.stringify(didData))
        }
      }]
    };

    console.log('📝 Prepared simple payment DID transaction:', paymentTx);

    // Use the same method priority as main function
    if (crossmark.methods?.signAndSubmitAndWait) {
      const response = await crossmark.methods.signAndSubmitAndWait(paymentTx);
      return extractTransactionHash(response, address);
    } else if (crossmark.methods?.submitAndWait) {
      const response = await crossmark.methods.submitAndWait(paymentTx);
      return extractTransactionHash(response, address);
    } else if (crossmark.methods?.submit) {
      await crossmark.methods.submit(paymentTx);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return await findRecentDIDTransaction(address);
    }

    throw new Error('No suitable Crossmark methods available for fallback');

  } catch (error) {
    console.error('❌ Simple payment DID fallback failed:', error);
    throw new Error(`Fallback DID creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Function to verify existing DID transaction by hash
export const getDIDTransactionByHash = async (txHash: string): Promise<boolean> => {
  try {
    await connectXRPL();
    
    console.log('🔍 Verifying DID transaction with hash:', txHash);
    
    // Validate hash format
    if (!/^[A-F0-9]{64}$/i.test(txHash)) {
      console.log('❌ Invalid transaction hash format');
      return false;
    }
    
    // Get transaction details
    const txResponse = await client.request({
      command: 'tx',
      transaction: txHash,
      binary: false
    });
    
    const txResult = txResponse.result as any; // Type assertion for XRPL response
    console.log('📄 Transaction details:', txResult);
    
    // The actual transaction data is in tx_json property for 'tx' command responses
    const transaction = txResult.tx_json || txResult;
    console.log('📄 Extracted transaction data:', transaction);
    
    // Check if it's a validated transaction with DID memo
    if (txResult.validated !== true) {
      console.log('❌ Transaction not validated');
      return false;
    }
    
    if (transaction.TransactionType !== 'AccountSet') {
      console.log(`❌ Not an AccountSet transaction, found: ${transaction.TransactionType}`);
      return false;
    }
    
    console.log('✅ Found AccountSet transaction');
    
    // Check for DID verification memo
    const memos = transaction.Memos || [];
    console.log(`📝 Found ${memos.length} memos in transaction`);
    
    const hasDIDMemo = memos.some((memo: any) => {
      try {
        const memoType = hexToString(memo.Memo?.MemoType || '');
        console.log(`📝 Checking memo type: "${memoType}"`);
        return memoType === 'DID_VERIFICATION';
      } catch (error) {
        console.log('⚠️ Failed to decode memo type:', error);
        return false;
      }
    });
    
    if (hasDIDMemo) {
      console.log('✅ Valid DID transaction confirmed');
      
      // Try to extract and log the DID data
      try {
        const didMemo = memos.find((memo: any) => {
          const memoType = hexToString(memo.Memo?.MemoType || '');
          return memoType === 'DID_VERIFICATION';
        });
        
        if (didMemo?.Memo?.MemoData) {
          const didData = JSON.parse(hexToString(didMemo.Memo.MemoData));
          console.log('📋 DID Data found:', didData);
        }
      } catch (error) {
        console.log('⚠️ Could not parse DID data, but transaction is valid:', error);
      }
      
      return true;
    } else {
      console.log('❌ No DID verification memo found');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Failed to verify transaction:', error);
    return false;
  }
};
