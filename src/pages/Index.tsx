import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { WelcomeSection } from '@/components/WelcomeSection';
import { MainContent } from '@/components/MainContent';
import { WalletSuccessPopup } from '@/components/WalletSuccessPopup';
import { useToast } from '@/hooks/use-toast';
import { XRPLWallet, fundLoanWithRLUSD, fundLoanWithRLUSDUniversal, fundLoanWithXRP, fundLoanWithXRPUniversal, getAccountTransactions, checkTrustLineExists, calculateTrustScore, TrustScore, getAccountBalances, AccountBalance, isDIDAppliedForLoans as checkDIDAppliedForLoans, applyDIDForLoans } from '@/utils/xrplClient';
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
  const [userRole, setUserRole] = useState<'borrower' | 'lender'>('borrower');
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
  const [userBalances, setUserBalances] = useState<AccountBalance[]>([]);
  const [isDIDAppliedForLoans, setIsDIDAppliedForLoans] = useState(false);
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

        setUserStats(prevStats => ({
          ...prevStats,
          totalBorrowed,
          activeLoans,
          completedLoans
        }));

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
          'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV'
        );
        console.log('🔗 Trust line check result:', hasTrustLine);
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

  // Fetch user balances
  const fetchUserBalances = async () => {
    if (userWallet) {
      try {
        const balances = await getAccountBalances(userWallet.address);
        setUserBalances(balances);
      } catch (error) {
        console.error('Failed to fetch user balances:', error);
      }
    }
  };

  // Check if DID has been applied for loans
  const checkDIDLoanApplicationStatus = async () => {
    if (userWallet) {
      try {
        const isApplied = await checkDIDAppliedForLoans(userWallet.address);
        setIsDIDAppliedForLoans(isApplied);
      } catch (error) {
        console.error('Failed to check DID loan application status:', error);
      }
    }
  };

  // Effect for fetching user-specific data when wallet connects
  useEffect(() => {
    if (userWallet) {
      fetchTransactions();
      checkRLUSDTrustLine();
      fetchUserTrustScore();
      fetchUserBalances();
      checkDIDLoanApplicationStatus();
      fetchUserLoanData();
    }
  }, [userWallet, didTransactionHash]);

  const handleWalletCreated = (walletInfo: XRPLWallet) => {
    // Wallet created successfully
    setUserWallet(walletInfo);
    setShowWalletSuccessPopup(true);

    // Check trust line after wallet creation
    setTimeout(checkRLUSDTrustLine, 3000);
  };

  const handleWalletConnected = (walletInfo: XRPLWallet) => {
    // Wallet connected successfully
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
    setUserBalances([]);
    setIsDIDAppliedForLoans(false);
  };

  const handleDIDCreated = async (txHash: string) => {
    setDidTransactionHash(txHash);
    toast({
      title: "DID Created",
      description: "Your decentralized identity has been created successfully.",
    });

    // Automatically apply the DID for loans to unlock NFT creation
    if (userWallet) {
      try {
        toast({
          title: "Activating DID for Loans",
          description: "Automatically enabling your DID for loan NFT creation...",
        });

        // Apply DID for loans automatically
        await applyDIDForLoans(userWallet.address, userWallet.seed);

        // Update the state to reflect that DID is now applied for loans
        setIsDIDAppliedForLoans(true);

        toast({
          title: "NFT Creation Unlocked",
          description: "Your DID is now active for creating loan NFTs!",
        });

      } catch (error) {
        console.error('Auto-apply DID for loans failed:', error);
        toast({
          title: "Manual Action Required",
          description: "DID created successfully, but you may need to manually apply it for loans in the Dashboard.",
          variant: "destructive",
        });
      }
    }

    // Refresh transactions and Trust Score after DID creation
    setTimeout(() => {
      fetchTransactions();
      fetchUserTrustScore();
      checkDIDLoanApplicationStatus();
    }, 3000);
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
    fetchUserBalances();
  };

  const handleFundLoan = async (loanId: string) => {
    // Check if the user has a connected wallet
    if (!userWallet) {
      toast({
        title: "Wallet Required",
        description: "Please connect a wallet first to fund loans.",
        variant: "destructive",
      });
      return;
    }

    // Find the loan to fund
    const loan = loans.find(l => l.id === loanId);
    if (!loan) {
      toast({
        title: "Loan Not Found",
        description: "The selected loan could not be found.",
        variant: "destructive",
      });
      return;
    }

    // Check if the user has RLUSD trust line
    console.log('🔗 RLUSD Trust Line Status:', hasRLUSDTrustLine);
    console.log('🔗 User has RLUSD balance, so they must have a trust line. Skipping trust line check for now.');
    
    // If user has RLUSD balance, they must have a trust line - skip this check for now
    const userHasRlusdBalance = userBalances.some(balance => 
      balance.currency === 'RLUSD' && 
      balance.issuer === 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV' &&
      parseFloat(balance.value) > 0
    );
    
    if (!hasRLUSDTrustLine && !userHasRlusdBalance) {
      toast({
        title: "RLUSD Trust Line Required",
        description: "You need to create an RLUSD trust line first to send RLUSD payments.",
        variant: "destructive",
      });
      return;
    }

    // Check if user has sufficient RLUSD balance
    console.log('🔍 Checking user balances:', userBalances);
    console.log('🔍 Looking for RLUSD with issuer: rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV');
    
    const rlusdBalance = userBalances.find(balance => 
      balance.currency === 'RLUSD' && 
      balance.issuer === 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV'
    );
    
    console.log('💰 Found RLUSD balance:', rlusdBalance);
    
    const fundingAmount = Math.min(1, loan.amount - loan.fundedAmount); // Fund up to 1 RLUSD or remaining amount (reduced for testing)
    const userRlusdAmount = rlusdBalance ? parseFloat(rlusdBalance.value) : 0;
    
    console.log(`💳 Funding amount needed: ${fundingAmount}, User RLUSD amount: ${userRlusdAmount}`);

    if (userRlusdAmount < fundingAmount) {
      toast({
        title: "Insufficient RLUSD Balance",
        description: `You need at least ${fundingAmount} RLUSD to fund this loan. Current balance: ${userRlusdAmount.toFixed(2)} RLUSD. Please acquire more RLUSD.`,
        variant: "destructive",
      });
      return;
    }

    const borrowerAddress = loan.borrower === 'You' ? userWallet.address : loan.borrower;

    try {
      // Show loading toast
      toast({
        title: "Processing RLUSD Payment",
        description: `Funding loan with ${fundingAmount} RLUSD on XRPL...`,
      });

      // Debug wallet configuration
      console.log('🔍 Debug: userWallet object:', {
        address: userWallet.address,
        hasSignTransaction: !!userWallet.signTransaction,
        hasSubmitTransaction: !!userWallet.submitTransaction,
        hasSeed: !!userWallet.seed,
        seedLength: userWallet.seed ? userWallet.seed.length : 0
      });

      // Call the universal fundLoanWithRLUSD function that handles both Crossmark and seed-based wallets
      const txHash = await fundLoanWithRLUSDUniversal(
        userWallet, 
        borrowerAddress, 
        fundingAmount, 
        loan.nftId
      );

      // Update loan funding in Supabase database
      const newFundedAmount = Math.min(loan.fundedAmount + fundingAmount, loan.amount);
      await updateLoanFunding(loanId, newFundedAmount, txHash);

      // Show success toast
      toast({
        title: "RLUSD Funding Successful",
        description: `Successfully funded ${fundingAmount} RLUSD. TX: ${txHash.slice(0, 8)}...`,
      });

      // Refresh loans to reflect new funding status
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

      // Refresh user data after successful funding
      setTimeout(() => {
        fetchTransactions();
        fetchUserTrustScore();
        fetchUserBalances();
      }, 2000);

    } catch (error: any) {
      console.error('RLUSD funding failed:', error);

      // Handle specific error cases
      if (error.message === 'MISSING_TRUSTLINE') {
        // Offer XRP fallback if borrower doesn't have RLUSD trustline
        const userConfirmed = window.confirm(
          `The borrower doesn't have an RLUSD trust line set up.\n\nWould you like to fund this loan with ${fundingAmount} XRP instead?`
        );

        if (userConfirmed) {
          try {
            toast({
              title: "Processing XRP Payment",
              description: "Funding loan with XRP as fallback...",
            });

            console.log('🚀 Starting XRP funding with universal function...');
            const xrpTxHash = await fundLoanWithXRPUniversal(userWallet, borrowerAddress, fundingAmount, loan.nftId);
            console.log('✅ XRP funding successful! Hash:', xrpTxHash);

            // Update funding in Supabase
            console.log('💾 Updating loan funding in database...');
            const newFundedAmount = Math.min(loan.fundedAmount + fundingAmount, loan.amount);
            await updateLoanFunding(loanId, newFundedAmount, xrpTxHash);
            console.log('💾 Database updated successfully');

            // Handle different hash scenarios
            if (xrpTxHash === 'TRANSACTION_SUCCEEDED_BUT_HASH_UNKNOWN') {
              toast({
                title: "XRP Funding Successful! 🎉",
                description: `Successfully funded ${fundingAmount} XRP! Transaction completed (hash not available).`,
              });
            } else {
              toast({
                title: "XRP Funding Successful! 🎉",
                description: `Successfully funded ${fundingAmount} XRP! TX: ${xrpTxHash.slice(0, 8)}...`,
              });
            }

            // Refresh loans after successful funding
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

            // Refresh data after successful funding
            setTimeout(() => {
              fetchTransactions();
              fetchUserTrustScore();
              fetchUserBalances();
            }, 2000);

          } catch (xrpError) {
            console.error('❌ XRP funding failed:', xrpError);
            console.error('❌ XRP error details:', {
              message: xrpError instanceof Error ? xrpError.message : 'Unknown error',
              stack: xrpError instanceof Error ? xrpError.stack : 'No stack trace',
              type: typeof xrpError
            });
            
            toast({
              title: "XRP Funding Failed",
              description: `Error: ${xrpError instanceof Error ? xrpError.message : 'Unknown error processing XRP payment'}`,
              variant: "destructive",
            });
          }
        }
      } else {
        // Handle other RLUSD funding errors
        toast({
          title: "RLUSD Funding Failed",
          description: "There was an error processing the RLUSD payment. Please try again.",
          variant: "destructive",
        });
      }
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
      fetchUserBalances();
    }, 2000);
  };

  const handleRoleChange = (role: 'borrower' | 'lender') => {
    setUserRole(role);
  };

  const handleFilterChange = (newFilters: typeof loanFilters) => {
    setLoanFilters(newFilters);
  };

  const handleSortChange = (newSort: typeof loanSort) => {
    setLoanSort(newSort);
  };

  const handleDIDLoanStatusChange = (isApplied: boolean) => {
    setIsDIDAppliedForLoans(isApplied);
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
          onTransactionUpdate={handleTransactionUpdate}
          hasRLUSDTrustLine={hasRLUSDTrustLine}
          onTrustLineCreated={handleTrustLineCreated}
          userBalances={userBalances}
          isDIDAppliedForLoans={isDIDAppliedForLoans}
          onDIDLoanStatusChange={handleDIDLoanStatusChange}
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