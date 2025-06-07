import { Client, Wallet, NFTokenMint, Payment, TxResponse, TrustSet, AccountSet } from 'xrpl';

// XRPL Client setup for Testnet
const client = new Client('wss://s.altnet.rippletest.net:51233');

export interface XRPLWallet {
  address: string;
  seed: string;
  balance: string;
  signTransaction?: (destination: string, amount: string) => Promise<string>;
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

  return {
    address: wallet.address,
    seed: wallet.seed!,
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
      balances.push({
        currency: line.currency,
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

// Create DID verification transaction using AccountSet
export const createDIDTransaction = async (wallet: Wallet, userData: { fullName: string; phone: string }): Promise<string> => {
  await connectXRPL();

  // Create DID data to store in memo
  const didData = {
    name: userData.fullName,
    phone: userData.phone,
    timestamp: Date.now(),
    verified: true
  };

  try {
    console.log('Creating DID transaction for wallet:', wallet.address);

    // Use AccountSet transaction with Domain field and memo for DID verification
    // This is more appropriate than a self-payment and won't trigger temREDUNDANT
    const accountSet: AccountSet = {
      TransactionType: 'AccountSet',
      Account: wallet.address,
      // Set a domain to indicate DID verification (optional)
      Domain: stringToHex('microlend.did'),
      Memos: [{
        Memo: {
          MemoType: stringToHex('DID_VERIFICATION'),
          MemoData: stringToHex(JSON.stringify(didData))
        }
      }]
    };

    console.log('Submitting DID AccountSet transaction...');

    // Use submitAndWait for better reliability
    const response: TxResponse<AccountSet> = await client.submitAndWait(accountSet, {
      wallet,
      autofill: true
    });

    console.log('DID transaction successful:', response.result.hash);

    // Check if transaction was successful
    if (response.result.validated !== true) {
      throw new Error('Transaction was not validated');
    }

    return response.result.hash || '';
  } catch (error) {
    console.error('DID transaction failed:', error);

    // Handle specific XRPL errors
    if (error instanceof Error) {
      if (error.message.includes('temREDUNDANT')) {
        throw new Error('DID already exists for this account');
      } else if (error.message.includes('tecUNFUNDED')) {
        throw new Error('Insufficient XRP balance for transaction');
      } else if (error.message.includes('timeout')) {
        throw new Error('Transaction timeout - please try again');
      }
    }

    throw new Error(`Failed to create DID transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

// Send RLUSD payment for loan funding with trust line check
export const fundLoanWithRLUSD = async (
  funderWallet: Wallet,
  borrowerAddress: string,
  amount: number
): Promise<string> => {
  await connectXRPL();

  // Check if borrower has RLUSD trust line
  const hasTrustLine = await checkTrustLineExists(borrowerAddress, 'RLUSD', RLUSD_ISSUER);

  if (!hasTrustLine) {
    // For now, send XRP instead with a memo explaining the issue
    const payment: Payment = {
      TransactionType: 'Payment',
      Account: funderWallet.address,
      Destination: borrowerAddress,
      Amount: (amount * 1000000).toString(), // Convert to drops
      Memos: [{
        Memo: {
          MemoType: stringToHex('LOAN_FUNDING_XRP'),
          MemoData: stringToHex(JSON.stringify({
            amount,
            timestamp: Date.now(),
            note: 'Sent as XRP - borrower needs RLUSD trust line'
          }))
        }
      }]
    };

    const response: TxResponse<Payment> = await client.submitAndWait(payment, { wallet: funderWallet });
    return response.result.hash || '';
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
        MemoType: stringToHex('LOAN_FUNDING'),
        MemoData: stringToHex(JSON.stringify({ amount, timestamp: Date.now() }))
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
