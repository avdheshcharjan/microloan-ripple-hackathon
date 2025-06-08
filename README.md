# Microloan Ripple Application

A decentralized peer-to-peer microloan platform built on the XRP Ledger (XRPL) that enables users to create, fund, and manage microloans using blockchain technology. The application leverages XRPL's native features including NFTs, trust lines, and payments to create a transparent and secure lending ecosystem.

## Overview

This application serves as a bridge between borrowers seeking small loans and lenders looking to provide funding. It uses the XRP Ledger's robust infrastructure to ensure secure, transparent, and efficient transactions while maintaining a user-friendly interface for both technical and non-technical users.

## Key Features

### For Borrowers
- **Loan Request Creation**: Create loan requests that are minted as NFTs on XRPL
- **DID Verification**: Establish digital identity for trust scoring
- **Multiple Currency Support**: Receive funding in RLUSD or XRP
- **Real-time Status Tracking**: Monitor loan funding progress and repayment status

### For Lenders
- **Browse Loan Opportunities**: View all available loan requests with detailed information
- **Risk Assessment**: Access trust scores and borrower verification status
- **Flexible Funding Options**: Fund loans using RLUSD (preferred) or XRP (fallback)
- **Portfolio Management**: Track lending history and returns

### Platform Features
- **Wallet Integration**: Support for both Crossmark wallet and seed-based wallets
- **Trust Line Management**: Automated RLUSD trust line creation and verification
- **Transaction History**: Complete audit trail of all lending activities
- **Responsive Design**: Mobile-friendly interface built with modern web technologies

## XRP Ledger Integration

### Architecture Overview

The application integrates deeply with the XRP Ledger through several key mechanisms:

#### 1. **Wallet Connection and Management**
```typescript
// Supports multiple wallet types
interface XRPLWallet {
  address: string;
  seed: string;
  balance: string;
  signTransaction?: (tx: any) => Promise<string>;
  submitTransaction?: (txBlob: string) => Promise<string>;
}
```

The platform supports two primary wallet connection methods:
- **Crossmark Wallet**: Browser extension integration for enhanced security
- **Seed-based Wallets**: Direct integration using XRPL seeds for development/testing

#### 2. **Loan NFT Creation**
Each loan request is represented as a Non-Fungible Token (NFT) on the XRP Ledger:

```typescript
// Loan data structure stored in NFT metadata
interface MicroloanNFT {
  nftId: string;
  borrower: string;
  amount: number;
  purpose: string;
  interestRate: number;
  duration: string;
  txHash: string;
}
```

**Process Flow:**
1. Borrower creates loan request through the UI
2. Application mints NFT using `NFTokenMint` transaction
3. Loan metadata is encoded in the NFT's URI field
4. NFT serves as immutable proof of loan terms
5. Transaction hash provides permanent audit trail

#### 3. **Trust Line Management**
The application uses RLUSD (Ripple USD) as the preferred lending currency:

```typescript
// RLUSD Configuration
const RLUSD_ISSUER = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV'; // Testnet issuer
const RLUSD_HEX = '524C555344000000000000000000000000000000'; // Hex-encoded currency code
```

**Trust Line Operations:**
- **Creation**: Automatically creates RLUSD trust lines for new users
- **Verification**: Checks borrower trust line status before funding
- **Fallback Handling**: Switches to XRP if RLUSD trust line is missing

#### 4. **Payment Processing**
The platform implements sophisticated payment routing:

**RLUSD Payments (Primary):**
```typescript
const payment: Payment = {
  TransactionType: 'Payment',
  Account: funderWallet.address,
  Destination: borrowerAddress,
  Amount: {
    currency: RLUSD_HEX,
    issuer: RLUSD_ISSUER,
    value: amount.toString()
  },
  Memos: [/* Loan metadata */]
};
```

**XRP Payments (Fallback):**
```typescript
const payment: Payment = {
  TransactionType: 'Payment',
  Account: funderWallet.address,
  Destination: borrowerAddress,
  Amount: (amount * 1000000).toString(), // XRP to drops conversion
  Memos: [/* Loan metadata */]
};
```

#### 5. **Digital Identity (DID) System**
Borrowers establish trust through on-chain identity verification:

**DID Creation Process:**
1. User provides personal information (name, phone)
2. Data is encoded and stored in XRPL transaction memo
3. DID transaction hash serves as identity anchor
4. Trust score is calculated based on DID presence and account history

**Trust Score Calculation:**
```typescript
interface TrustScore {
  score: number;
  risk: 'low' | 'medium' | 'high';
  factors: {
    hasDID: boolean;
    transactionCount: number;
    accountAge?: number;
  };
}
```

#### 6. **Transaction Monitoring and History**
The application provides comprehensive transaction tracking:

**Features:**
- Real-time balance monitoring
- Transaction history with categorization
- Automated status updates for loan funding
- Explorer integration for transaction verification

### Technical Implementation Details

#### Connection Management
```typescript
// XRPL Client Configuration
const client = new Client('wss://s.altnet.rippletest.net:51233'); // Testnet WebSocket

export const connectXRPL = async (): Promise<void> => {
  if (!client.isConnected()) {
    await client.connect();
  }
};
```

#### Universal Transaction Handling
The application implements universal functions that work with both Crossmark and seed-based wallets:

```typescript
// Example: Universal funding function
export const fundLoanWithRLUSDUniversal = async (
  walletInfo: XRPLWallet,
  borrowerAddress: string,
  amount: number,
  loanNFTId?: string
): Promise<string> => {
  // Check borrower trust line
  const hasTrustLine = await checkTrustLineExists(borrowerAddress, 'RLUSD', RLUSD_ISSUER);
  
  if (!hasTrustLine) {
    throw new Error('MISSING_TRUSTLINE');
  }
  
  // Route to appropriate wallet handler
  if (walletInfo.signTransaction && walletInfo.submitTransaction) {
    return fundLoanWithCrossmark(/* ... */);
  } else if (walletInfo.seed && isValidXRPLSeed(walletInfo.seed)) {
    return fundLoanWithSeed(/* ... */);
  } else {
    return fundLoanWithCrossmarkGlobal(/* ... */);
  }
};
```

#### Error Handling and Fallbacks
The platform implements robust error handling with automatic fallbacks:

1. **Trust Line Missing**: Automatically offers XRP funding option
2. **Transaction Failures**: Provides detailed error messages and retry options
3. **Network Issues**: Implements connection retry logic
4. **Wallet Integration**: Falls back to different Crossmark methods if primary fails

### Data Flow Architecture

```
1. User Action (UI) 
   ↓
2. Frontend Validation
   ↓  
3. XRPL Transaction Preparation
   ↓
4. Wallet Integration (Crossmark/Seed)
   ↓
5. Transaction Submission to XRPL
   ↓
6. Transaction Confirmation
   ↓
7. Database Update (Supabase)
   ↓
8. UI State Update
   ↓
9. User Notification
```

## Technology Stack

### Frontend
- **React 18** with TypeScript for type-safe component development
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for responsive, utility-first styling
- **Shadcn/ui** for consistent, accessible UI components
- **React Router** for client-side navigation
- **React Query** for efficient data fetching and caching

### Blockchain Integration
- **xrpl.js v4.2.5** - Official XRP Ledger JavaScript library
- **Crossmark SDK v0.3.9** - Browser wallet integration
- **Custom XRPL utilities** for transaction management and wallet operations

### Backend Services
- **Supabase** for user data, loan records, and application state
- **PostgreSQL** database for relational data storage
- **Real-time subscriptions** for live updates

### Development Tools
- **TypeScript** for enhanced code quality and developer experience
- **ESLint** for code linting and consistency
- **Bun** for fast package management and builds

## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- Crossmark wallet extension (recommended) or XRPL testnet account with seed

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd microloan-ripple-hackathon
```

2. **Install dependencies**
```bash
# Using npm
npm install

# Using bun (recommended)
bun install
```

3. **Environment Setup**
Create a `.env` file with necessary configuration:
```env
VITE_NETWORK=testnet
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Start the development server**
```bash
# Using npm
npm run dev

# Using bun
bun run dev
```

5. **Access the application**
Open your browser and navigate to `http://localhost:5173`

### Wallet Setup

#### Option 1: Crossmark Wallet (Recommended)
1. Install the [Crossmark browser extension](https://crossmark.io/)
2. Create or import an XRP Ledger testnet account
3. Fund your account using the [XRP Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html)
4. Connect to the application using the Crossmark option

#### Option 2: Seed-based Connection
1. Use an existing XRPL testnet seed or generate one
2. Ensure the account has sufficient XRP for transactions
3. Connect using the seed phrase option in the application

## Usage Guide

### For Borrowers

1. **Connect Wallet**: Use Crossmark or seed-based connection
2. **Verify Identity**: Complete DID verification for better trust scores
3. **Create RLUSD Trust Line**: Set up trust line for RLUSD payments
4. **Submit Loan Request**: Fill out loan details and mint NFT
5. **Monitor Funding**: Track funding progress in real-time
6. **Manage Repayments**: Handle loan repayments and status updates

### For Lenders

1. **Connect Wallet**: Establish connection to your XRP Ledger account
2. **Browse Opportunities**: Review available loan requests
3. **Assess Risk**: Evaluate borrower trust scores and verification status
4. **Fund Loans**: Provide funding using RLUSD or XRP
5. **Track Portfolio**: Monitor lending performance and returns

## API Reference

### Key XRPL Functions

#### Wallet Management
- `createXRPLWallet()`: Generate new XRPL wallet
- `connectXRPL()`: Establish connection to XRPL network
- `getAccountBalances(address)`: Fetch account balances
- `getAccountTransactions(address)`: Retrieve transaction history

#### Loan Operations
- `createMicroloanNFTUniversal(wallet, loanData)`: Mint loan NFT
- `fundLoanWithRLUSDUniversal(wallet, borrower, amount)`: Fund with RLUSD
- `fundLoanWithXRPUniversal(wallet, borrower, amount)`: Fund with XRP

#### Identity and Trust
- `createDIDTransaction(wallet, userData)`: Create digital identity
- `calculateTrustScore(address)`: Calculate user trust score
- `isDIDAppliedForLoans(address)`: Check loan eligibility

#### Trust Lines
- `createRLUSDTrustLine(wallet)`: Create RLUSD trust line
- `checkTrustLineExists(address, currency, issuer)`: Verify trust line status

## Contributing

We welcome contributions to improve the microloan platform! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow TypeScript best practices** and maintain type safety
3. **Test XRPL integrations** on testnet before submitting
4. **Update documentation** for any new features or changes
5. **Submit pull requests** with clear descriptions of changes

### Development Guidelines
- Use meaningful commit messages
- Implement proper error handling for all XRPL operations
- Maintain backward compatibility with existing wallet integrations
- Add unit tests for new utility functions
- Update this README for significant feature additions

## Testing

The application is designed for the XRP Ledger Testnet environment:

- **Testnet WebSocket**: `wss://s.altnet.rippletest.net:51233`
- **RLUSD Issuer**: `rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`
- **Explorer**: [XRPL Testnet Explorer](https://testnet.xrpl.org)
- **Faucet**: [XRP Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html)

### Sample transactions from our project
- https://test.xrplexplorer.com/en/tx/61F785C666794DFE596EFEB02C7036F5C4E03A03749AF73DE1629518A1639113
- https://test.xrplexplorer.com/en/tx/FD2E6411294EE2699FB32D10E6B8AD38E4718158DC837F873DE50B14EC340102

### Testing Scenarios
1. **Wallet Connection**: Test both Crossmark and seed-based connections
2. **Trust Line Management**: Verify RLUSD trust line creation and detection
3. **Loan Creation**: Test NFT minting with various loan parameters
4. **Funding Operations**: Test both RLUSD and XRP funding flows
5. **Error Handling**: Verify graceful handling of failed transactions

## Security Considerations

- **Seed Handling**: Seeds are never stored permanently and are handled securely
- **Transaction Validation**: All transactions are validated before submission
- **Trust Line Verification**: Automatic verification prevents failed payments
- **Error Boundaries**: Comprehensive error handling prevents application crashes
- **Network Security**: Uses secure WebSocket connections to XRPL

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions, issues, or contributions:
- Create an issue on GitHub
- Contact the development team
- Check the XRPL documentation for ledger-specific questions

## Acknowledgments

- **Ripple and XRPL Community** for the robust blockchain infrastructure
- **Crossmark Team** for excellent wallet integration tools
- **Open Source Contributors** who have helped improve this platform

---

*Built with ❤️ for the XRP Ledger ecosystem*