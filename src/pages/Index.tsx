import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { WelcomeSection } from '@/components/WelcomeSection';
import { MainContent } from '@/components/MainContent';
import { WalletSuccessPopup } from '@/components/WalletSuccessPopup';
import { useToast } from '@/hooks/use-toast';
import { XRPLWallet, fundLoanWithRLUSD, getAccountTransactions, checkTrustLineExists, calculateTrustScore, TrustScore } from '@/utils/xrplClient';
import { Wallet } from 'xrpl';
import { XRPL_EXPLORER_URL } from '@/utils/constants';
import { createLoanInDB, fetchUserLoans, fetchAllLoans, updateLoanFunding, type DBLoan, type LoanFilters } from '@/utils/supabase';

interface UserStats {
  totalLent: number;
  totalBorrowed: number;
  activeLoans: number;
  completedLoans: number;
  portfolioReturn: number;
}

const Index = () => {
  const [userWallet, setUserWallet] = useState<XRPLWallet | null>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    totalLent: 0,
    totalBorrowed: 0,
    activeLoans: 0,
    completedLoans: 0,
    portfolioReturn: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [showWalletSuccessPopup, setShowWalletSuccessPopup] = useState(false);
  const [didTransactionHash, setDidTransactionHash] = useState('');
  const [hasRLUSDTrustLine, setHasRLUSDTrustLine] = useState(false);
  const [userTrustScore, setUserTrustScore] = useState<TrustScore | null>(null);
  const [loanFilters, setLoanFilters] = useState({
    status: undefined as 'active' | 'funded' | 'completed' | undefined,
    riskScore: undefined as 'low' | 'medium' | 'high' | undefined,
    minAmount: undefined as number | undefined,
    maxAmount: undefined as number | undefined
  });
  const [loanSort, setLoanSort] = useState({
    column: 'created_at' as 'created_at' | 'amount' | 'interest_rate' | 'funded_amount',
    ascending: false
  });

  const { toast } = useToast();

  // Effect for fetching all loans when filters change
  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const filters: LoanFilters = {
          status: loanFilters.status,
          riskScore: loanFilters.riskScore,
          minAmount: loanFilters.minAmount,
          maxAmount: loanFilters.maxAmount,
          orderBy: {
            column: loanSort.column || 'created_at',
            ascending: loanSort.ascending
          }
        };

        const dbLoans = await fetchAllLoans(filters);
        
        // Transform DB loans to UI format
        const uiLoans = dbLoans.map(loan => ({
          id: loan.id,
          borrower: loan.borrower_address === userWallet?.address ? 'You' : loan.borrower_address,
          amount: loan.amount,
          purpose: loan.purpose,
          interestRate: loan.interest_rate,
          duration: loan.duration,
          fundedAmount: loan.funded_amount,
          status: loan.status,
          didVerified: loan.did_verified,
          riskScore: loan.risk_score,
          createdAt: loan.created_at,
          nftId: loan.nft_id,
          txHash: loan.tx_hash
        }));

        setLoans(uiLoans);
      } catch (error) {
        console.error('Failed to fetch loans:', error);
        toast({
          title: "Error",
          description: "Failed to fetch loans. Please try again.",
          variant: "destructive"
        });
      }
    };

    fetchLoans();
  }, [loanFilters, loanSort, userWallet?.address, toast]);

  // Fetch user's loans
  const fetchUserLoanData = async () => {
    if (userWallet?.address) {
      try {
        const userLoans = await fetchUserLoans(userWallet.address);
        
        // Transform DB loans to UI format
        const uiLoans = userLoans.map(loan => ({
          id: loan.id,
          borrower: 'You',
          amount: loan.amount,
          purpose: loan.purpose,
          interestRate: loan.interest_rate,
          duration: loan.duration,
          fundedAmount: loan.funded_amount,
          status: loan.status,
          didVerified: loan.did_verified,
          riskScore: loan.risk_score,
          createdAt: loan.created_at,
          nftId: loan.nft_id,
          txHash: loan.tx_hash
        }));

        // Calculate user stats
        const totalBorrowed = userLoans.reduce((sum, loan) => sum + loan.amount, 0);
        const activeLoans = userLoans.filter(loan => loan.status === 'active').length;
        const completedLoans = userLoans.filter(loan => loan.status === 'completed').length;

        setUserStats({
          ...userStats,
          totalBorrowed,
          activeLoans,
          completedLoans
        });

        // Update loans state
        setLoans(prevLoans => {
          const nonUserLoans = prevLoans.filter(loan => loan.borrower !== 'You');
          return [...uiLoans, ...nonUserLoans];
        });
      } catch (error) {
        console.error('Failed to fetch user loans:', error);
      }
    }
  };

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

  // Effect for fetching user-specific data when wallet connects
  useEffect(() => {
    if (userWallet) {
      fetchTransactions();
      checkRLUSDTrustLine();
      fetchUserTrustScore();
      fetchUserLoanData();
    }
  }, [userWallet, didTransactionHash]);

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
    setUserStats({
      totalLent: 0,
      totalBorrowed: 0,
      activeLoans: 0,
      completedLoans: 0,
      portfolioReturn: 0
    });
    setRecentActivity([]);
    setShowWalletSuccessPopup(false);
    setHasRLUSDTrustLine(false);
    setUserTrustScore(null);
  };

  const handleDIDCreated = async (txHash: string) => {
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

  const handleCreateLoan = async (newLoan: DBLoan) => {
    try {
      console.log('Received loan data:', {
        newLoan,
        userWallet: userWallet ? {
          address: userWallet.address,
          exists: !!userWallet
        } : null,
        didTransactionHash: !!didTransactionHash
      });
      
      // Validate required fields
      if (!newLoan.id || !newLoan.nft_id || !userWallet?.address) {
        console.error('Validation failed:', {
          hasId: !!newLoan.id,
          hasNftId: !!newLoan.nft_id,
          hasWalletAddress: !!userWallet?.address
        });
        throw new Error('Missing required fields for loan creation');
      }

      // Create loan in Supabase - use the newLoan directly since it's already in DBLoan format
      console.log('Sending loan data to Supabase:', newLoan);

      await createLoanInDB(newLoan);

      // Update local state - transform DBLoan to UI format
      setLoans(prevLoans => [...prevLoans, {
        id: newLoan.id,
        borrower: 'You',
        amount: newLoan.amount,
        purpose: newLoan.purpose,
        interestRate: newLoan.interest_rate,
        duration: newLoan.duration,
        fundedAmount: newLoan.funded_amount,
        status: newLoan.status,
        didVerified: newLoan.did_verified,
        riskScore: newLoan.risk_score,
        createdAt: newLoan.created_at,
        nftId: newLoan.nft_id,
        txHash: newLoan.tx_hash
      }]);

      toast({
        title: "Loan Created",
        description: "Your loan has been created and stored successfully.",
      });

    } catch (error) {
      console.error('Failed to create loan:', error);
      let errorMessage = "Failed to create loan. Please try again.";
      
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleTransactionUpdate = () => {
    fetchTransactions();
    fetchUserLoanData();
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

      // Create wallet instance from seed
      const wallet = Wallet.fromSeed(userWallet.seed);
      
      // Process RLUSD payment on XRPL
      const fundingAmount = 100; // You can make this dynamic based on user input
      const txHash = await fundLoanWithRLUSD(
        wallet, 
        loan.borrower === 'You' ? userWallet.address : loan.borrower, 
        fundingAmount
      );

      // Update funding in Supabase
      const newFundedAmount = Math.min(loan.fundedAmount + fundingAmount, loan.amount);
      await updateLoanFunding(loanId, newFundedAmount, txHash);

      // Refresh loans
      const filters: LoanFilters = {
        status: loanFilters.status,
        riskScore: loanFilters.riskScore,
        minAmount: loanFilters.minAmount,
        maxAmount: loanFilters.maxAmount,
        orderBy: {
          column: loanSort.column || 'created_at',
          ascending: loanSort.ascending
        }
      };

      const dbLoans = await fetchAllLoans(filters);
      
      // Transform DB loans to UI format
      const uiLoans = dbLoans.map(loan => ({
        id: loan.id,
        borrower: loan.borrower_address === userWallet.address ? 'You' : loan.borrower_address,
        amount: loan.amount,
        purpose: loan.purpose,
        interestRate: loan.interest_rate,
        duration: loan.duration,
        fundedAmount: loan.funded_amount,
        status: loan.status,
        didVerified: loan.did_verified,
        riskScore: loan.risk_score,
        createdAt: loan.created_at,
        nftId: loan.nft_id,
        txHash: loan.tx_hash
      }));

      setLoans(uiLoans);

      toast({
        title: "Funding Successful",
        description: `RLUSD payment processed on XRPL. TX: ${txHash.slice(0, 8)}...`,
      });

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

  const handleFilterChange = (newFilters: typeof loanFilters) => {
    setLoanFilters(newFilters);
  };

  const handleSortChange = (newSort: typeof loanSort) => {
    setLoanSort(newSort);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        hasWallet={!!userWallet}
        didTransactionHash={didTransactionHash}
        walletAddress={userWallet?.address || ''}
        onLogout={handleLogout}
      />

      <main className="container mx-auto px-4 py-8">
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
            onCreateLoan={handleCreateLoan}
            onFundLoan={handleFundLoan}
            userWallet={userWallet}
            didTransactionHash={didTransactionHash}
            onDIDCreated={handleDIDCreated}
            onTransactionUpdate={handleTransactionUpdate}
            hasRLUSDTrustLine={hasRLUSDTrustLine}
            onTrustLineCreated={handleTrustLineCreated}
          />
        )}
      </main>

      <WalletSuccessPopup
        isOpen={showWalletSuccessPopup}
        onClose={handleWalletPopupClose}
        walletAddress={userWallet?.address || ''}
        balance={userWallet?.balance || '0'}
      />
    </div>
  );
};

export default Index;
