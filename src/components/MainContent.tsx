import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoanCard } from '@/components/LoanCard';
import { CreateLoanForm } from '@/components/CreateLoanForm';
import { Dashboard } from '@/components/Dashboard';
import { Filter, SortAsc, SortDesc } from 'lucide-react';
import { XRPLWallet, AccountBalance } from '@/utils/xrplClient';

interface Loan {
  id: string;
  borrower: string;
  amount: number;
  purpose: string;
  interestRate: number;
  duration: string;
  fundedAmount: number;
  status: 'active' | 'funded' | 'completed';
  didVerified: boolean;
  riskScore: 'low' | 'medium' | 'high';
  createdAt: string;
  nftId: string;
  txHash: string;
}

interface UserStats {
  totalLent: number;
  totalBorrowed: number;
  activeLoans: number;
  completedLoans: number;
  portfolioReturn: number;
}

interface RecentActivity {
  id: string;
  type: string;
  amount: number;
  description: string;
  hash?: string;
  date: string;
  account?: string;
  destination?: string;
}

interface MainContentProps {
  loans: Loan[];
  userStats: UserStats;
  recentActivity: any[];
  hasWallet: boolean;
  userRole: 'borrower' | 'lender';
  onCreateLoan: (loan: any) => void;
  onFundLoan: (loanId: string) => void;
  userWallet?: XRPLWallet;
  didTransactionHash: string;
  onDIDCreated: (txHash: string) => void;
  onTransactionUpdate?: () => void;
  hasRLUSDTrustLine: boolean;
  onTrustLineCreated: () => void;
  userBalances: AccountBalance[];
  isDIDAppliedForLoans?: boolean;
  onDIDLoanStatusChange?: (isApplied: boolean) => void;
}

export const MainContent: React.FC<MainContentProps> = ({
  loans,
  userStats,
  recentActivity,
  hasWallet,
  userRole,
  onCreateLoan,
  onFundLoan,
  userWallet,
  didTransactionHash,
  onDIDCreated,
  onTransactionUpdate,
  hasRLUSDTrustLine,
  onTrustLineCreated,
  userBalances,
  isDIDAppliedForLoans = false,
  onDIDLoanStatusChange
}) => {
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [sortBy, setSortBy] = useState<'amount' | 'interest' | 'trustScore'>('amount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort loans
  const filteredAndSortedLoans = React.useMemo(() => {
    // First exclude the user's own loans
    let filtered = loans.filter(loan => loan.borrower !== 'You');

    // Apply risk filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter(loan => loan.riskScore === riskFilter);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'interest':
          comparison = a.interestRate - b.interestRate;
          break;
        case 'trustScore':
          // For trust score, we need to convert risk to a numeric value for sorting
          const riskToScore = { low: 3, medium: 2, high: 1 };
          comparison = (riskToScore[a.riskScore as keyof typeof riskToScore] || 0) - 
                      (riskToScore[b.riskScore as keyof typeof riskToScore] || 0);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [loans, riskFilter, sortBy, sortOrder]);

  // Get user's own loans
  const myLoans = React.useMemo(() => {
    return loans.filter(loan => loan.borrower === 'You');
  }, [loans]);

  // Get other loans (excluding user's own)
  const otherLoans = React.useMemo(() => {
    return filteredAndSortedLoans.filter(loan => !myLoans.some(myLoan => myLoan.id === loan.id));
  }, [filteredAndSortedLoans, myLoans]);

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  // Define tabs based on user role
  const borrowerTabs = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'loans', label: 'Loans' },
    { value: 'create', label: 'Create Loan NFT' }
  ];

  const lenderTabs = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'loans', label: 'Loans' },
    { value: 'portfolio', label: 'Portfolio' }
  ];

  const currentTabs = userRole === 'borrower' ? borrowerTabs : lenderTabs;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          {currentTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard">
          <Dashboard
            userStats={userStats}
            recentActivity={recentActivity}
            userWallet={userWallet}
            didTransactionHash={didTransactionHash}
            onDIDCreated={onDIDCreated}
            onTransactionUpdate={onTransactionUpdate}
            showWalletDetails={true}
            hasRLUSDTrustLine={hasRLUSDTrustLine}
            onTrustLineCreated={onTrustLineCreated}
            userRole={userRole}
            onDIDLoanStatusChange={onDIDLoanStatusChange}
          />
        </TabsContent>

        <TabsContent value="loans" className="space-y-8">
          {/* My Loans Section */}
          <div>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">My {userRole === 'borrower' ? 'Loan Applications' : 'Funded Loans'}</h3>
              <p className="text-gray-600">
                {userRole === 'borrower' 
                  ? 'Track your loan applications and status' 
                  : 'Monitor your lending portfolio and returns'}
              </p>
            </div>

            {myLoans.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">
                  {userRole === 'borrower' 
                    ? "You haven't created any loan NFTs yet." 
                    : "You haven't funded any loans yet."}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {userRole === 'borrower'
                    ? 'Switch to the "Create Loan NFT" tab to get started.'
                    : 'Browse available loans below to start lending.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myLoans.map((loan) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    isOwn={true}
                    userBalances={userBalances}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Other Loans Section */}
          <div>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {userRole === 'borrower' ? 'Other Active Loans' : 'Available Loan NFTs'}
                </h3>
                <p className="text-gray-600">
                  {userRole === 'borrower'
                    ? 'View other borrowers in the community'
                    : 'Fund microloans with RLUSD for stable returns'}
                </p>
              </div>

              {/* Filtering and Sorting Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Filter by risk:</span>
                  <Select value={riskFilter} onValueChange={(value: 'all' | 'low' | 'medium' | 'high') => setRiskFilter(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk</SelectItem>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Sort by:</span>
                  <Select value={sortBy} onValueChange={(value: 'amount' | 'interest' | 'trustScore') => setSortBy(value)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="interest">Interest Rate</SelectItem>
                      <SelectItem value="trustScore">Trust Score</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSortOrder}
                    className="h-8 w-8 p-0"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Results Summary */}
            <div className="flex items-center gap-4 mb-4">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {otherLoans.length} loan{otherLoans.length !== 1 ? 's' : ''} available
              </Badge>
              {riskFilter !== 'all' && (
                <Badge variant="outline" className="bg-gray-50">
                  Filtered by: {riskFilter} risk
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherLoans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  onFund={userRole === 'lender' ? onFundLoan : undefined}
                  hasRLUSDTrustLine={hasRLUSDTrustLine}
                  userBalances={userBalances}
                />
              ))}
            </div>

            {otherLoans.length === 0 && filteredAndSortedLoans.length > 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No loans match your current filters.</p>
                <Button
                  variant="outline"
                  onClick={() => setRiskFilter('all')}
                  className="mt-2"
                >
                  Clear Filters
                </Button>
              </div>
            )}

            {filteredAndSortedLoans.length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No loan NFTs available at the moment.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Create Loan NFT Tab - Only for borrowers */}
        {userRole === 'borrower' && (
          <TabsContent value="create">
            <CreateLoanForm
              onCreateLoan={onCreateLoan}
              userDidVerified={isDIDAppliedForLoans}
              userWallet={userWallet}
              onRefreshDIDStatus={onTransactionUpdate}
            />
          </TabsContent>
        )}

        {/* Portfolio Tab - Only for lenders (placeholder for now) */}
        {userRole === 'lender' && (
          <TabsContent value="portfolio">
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Portfolio</h3>
                <p className="text-gray-600">Your lending portfolio and performance metrics</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500">Portfolio view coming soon...</p>
                <p className="text-sm text-gray-400 mt-2">This will show your funded loans, returns, and performance analytics.</p>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
