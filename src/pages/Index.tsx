import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { WelcomeSection } from '@/components/WelcomeSection';
import { MainContent } from '@/components/MainContent';
import { WalletSuccessPopup } from '@/components/WalletSuccessPopup';
import { useToast } from '@/hooks/use-toast';
import { XRPLWallet, fundLoanWithRLUSD, getAccountTransactions, checkTrustLineExists, calculateTrustScore, TrustScore } from '@/utils/xrplClient';
import { Wallet } from 'xrpl';
import { XRPL_EXPLORER_URL } from '@/utils/constants';

const Index = () => {
  const [userWallet, setUserWallet] = useState<XRPLWallet | null>(null);
  const [userRole, setUserRole] = useState<'borrower' | 'lender'>('borrower');
  const [showWalletSuccessPopup, setShowWalletSuccessPopup] = useState(false);
  const [didTransactionHash, setDidTransactionHash] = useState('');
  const [loans, setLoans] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [hasRLUSDTrustLine, setHasRLUSDTrustLine] = useState(false);
  const [userTrustScore, setUserTrustScore] = useState<TrustScore | null>(null);

  const [userStats] = useState({
    totalLent: 0,
    totalBorrowed: 0,
    activeLoans: 0,
    completedLoans: 0,
    portfolioReturn: 0
  });

  const { toast } = useToast();

  // Check RLUSD trust line status
  const checkRLUSDTrustLine = async () => {
    if (userWallet) {
      try {
        const hasTrustLine = await checkTrustLineExists(
          userWallet.address,
          'RLUSD',
          'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'
        );
        setHasRLUSDTrustLine(hasTrustLine);
      } catch (error) {
        console.error('Failed to check RLUSD trust line:', error);
      }
    }
  };

  // Fetch wallet transactions when wallet is available
  const fetchTransactions = async () => {
    if (userWallet) {
      try {
        const transactions = await getAccountTransactions(userWallet.address);
        setRecentActivity(transactions);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      }
    }
  };

  // Fetch user's Trust Score
  const fetchUserTrustScore = async () => {
    if (userWallet) {
      try {
        const score = await calculateTrustScore(userWallet.address);
        setUserTrustScore(score);
      } catch (error) {
        console.error('Failed to fetch user trust score:', error);
      }
    }
  };

  useEffect(() => {
    fetchTransactions();
    checkRLUSDTrustLine();
    fetchUserTrustScore();
  }, [userWallet, didTransactionHash]); // Re-fetch when DID is created

  const handleWalletCreated = (walletInfo: XRPLWallet) => {
    console.log('Wallet created:', walletInfo);
    setUserWallet(walletInfo);
    setShowWalletSuccessPopup(true);
    
    // Check trust line after wallet creation
    setTimeout(checkRLUSDTrustLine, 3000);
  };

  const handleWalletConnected = (walletInfo: XRPLWallet) => {
    console.log('Wallet connected:', walletInfo);
    setUserWallet(walletInfo);
    // Skip success popup for existing wallet connections - go directly to dashboard
    
    // Check trust line after wallet connection
    setTimeout(checkRLUSDTrustLine, 3000);
  };

  const handleWalletPopupClose = () => {
    setShowWalletSuccessPopup(false);
  };

  const handleLogout = () => {
    setUserWallet(null);
    setDidTransactionHash('');
    setLoans([]);
    setRecentActivity([]);
    setShowWalletSuccessPopup(false);
    setHasRLUSDTrustLine(false);
    setUserTrustScore(null);
  };

  const handleDIDCreated = (txHash: string) => {
    setDidTransactionHash(txHash);
    toast({
      title: "DID Created",
      description: "Your decentralized identity has been created successfully.",
    });
    // Refresh transactions and Trust Score after DID creation
    setTimeout(() => {
      fetchTransactions();
      fetchUserTrustScore();
    }, 2000);
  };

  const handleCreateLoan = (newLoan: any) => {
    const txUrl = `${XRPL_EXPLORER_URL}${newLoan.txHash}`;
    const loanWithTx = {
      ...newLoan,
      txUrl,
      // Use actual Trust Score if available, otherwise fallback to medium risk
      riskScore: userTrustScore?.risk || 'medium',
      borrower: userWallet?.address || 'You'
    };
    
    setLoans([loanWithTx, ...loans]);
    
    toast({
      title: "Loan NFT Created",
      description: (
        <div>
          Loan NFT created successfully!
          <a 
            href={txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-1 text-sm text-blue-500 hover:text-blue-600 underline"
          >
            View transaction details →
          </a>
        </div>
      ),
    });
  };

  const handleFundLoan = async (loanId: string) => {
    if (!userWallet) {
      toast({
        title: "Wallet Required",
        description: "Please create a wallet first.",
        variant: "destructive",
      });
      return;
    }

    // Check if user has RLUSD trust line
    if (!hasRLUSDTrustLine) {
      toast({
        title: "RLUSD Trust Line Required",
        description: "You need to create an RLUSD trust line first to send RLUSD payments.",
        variant: "destructive",
      });
      return;
    }

    try {
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return;

      toast({
        title: "Processing RLUSD Payment",
        description: "Funding loan with RLUSD on XRPL...",
      });

      const wallet = Wallet.fromSeed(userWallet.seed);
      const txHash = await fundLoanWithRLUSD(wallet, loan.borrower, 100);

      toast({
        title: "Funding Successful",
        description: `RLUSD payment processed on XRPL. TX: ${txHash.slice(0, 8)}...`,
      });

      setLoans(loans.map(loan => 
        loan.id === loanId 
          ? { ...loan, fundedAmount: Math.min(loan.fundedAmount + 100, loan.amount) }
          : loan
      ));

      // Refresh transactions and Trust Score after funding
      setTimeout(() => {
        fetchTransactions();
        fetchUserTrustScore();
      }, 2000);
    } catch (error) {
      console.error('Funding failed:', error);
      toast({
        title: "Funding Failed",
        description: "There was an error processing the RLUSD payment.",
        variant: "destructive",
      });
    }
  };

  const handleTrustLineCreated = () => {
    setHasRLUSDTrustLine(true);
    toast({
      title: "RLUSD Ready",
      description: "Your wallet can now send and receive RLUSD payments!",
    });
    // Refresh transactions and Trust Score after trust line creation
    setTimeout(() => {
      fetchTransactions();
      fetchUserTrustScore();
    }, 2000);
  };

  const handleRoleChange = (role: 'borrower' | 'lender') => {
    setUserRole(role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <Header 
        hasWallet={!!userWallet}
        didTransactionHash={didTransactionHash}
        walletAddress={userWallet?.address || ''}
        userRole={userRole}
        onRoleChange={handleRoleChange}
        onLogout={handleLogout}
      />
      
      {!userWallet ? (
        <WelcomeSection
          hasWallet={!!userWallet}
          onWalletCreated={handleWalletCreated}
          onWalletConnected={handleWalletConnected}
        />
      ) : (
        <MainContent
          loans={loans}
          userStats={userStats}
          recentActivity={recentActivity}
          hasWallet={!!userWallet}
          userRole={userRole}
          onCreateLoan={handleCreateLoan}
          onFundLoan={handleFundLoan}
          userWallet={userWallet}
          didTransactionHash={didTransactionHash}
          onDIDCreated={handleDIDCreated}
          onTransactionUpdate={fetchTransactions}
          hasRLUSDTrustLine={hasRLUSDTrustLine}
          onTrustLineCreated={handleTrustLineCreated}
        />
      )}
      
      {showWalletSuccessPopup && userWallet && (
        <WalletSuccessPopup
          isOpen={showWalletSuccessPopup}
          onClose={handleWalletPopupClose}
          walletAddress={userWallet.address}
          balance={userWallet.balance}
        />
      )}
    </div>
  );
};

export default Index;
