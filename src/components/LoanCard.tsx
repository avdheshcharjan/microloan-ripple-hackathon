import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { User, Clock, DollarSign, Shield, Loader2, Info } from 'lucide-react';
import { calculateTrustScore, TrustScore, AccountBalance } from '@/utils/xrplClient';

interface LoanCardProps {
  loan: {
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
  };
  onFund?: (loanId: string) => void;
  isOwn?: boolean;
  hasRLUSDTrustLine?: boolean;
  userBalances?: AccountBalance[];
}

export const LoanCard: React.FC<LoanCardProps> = ({ loan, onFund, isOwn = false, hasRLUSDTrustLine = false, userBalances = [] }) => {
  const [trustScore, setTrustScore] = useState<TrustScore | null>(null);
  const [loadingTrustScore, setLoadingTrustScore] = useState(true);
  const fundingProgress = (loan.fundedAmount / loan.amount) * 100;

  useEffect(() => {
    const fetchTrustScore = async () => {
      try {
        setLoadingTrustScore(true);
        // For own loans, calculate a base score using DID status
        if (isOwn || loan.borrower === 'You') {
          const baseScore = loan.didVerified ? 10 : 0; // DID verification gives 10 points
          let risk: 'low' | 'medium' | 'high';
          
          // Determine risk level based on DID status
          if (baseScore >= 10) {
            risk = 'low';
          } else if (baseScore >= 5) {
            risk = 'medium';
          } else {
            risk = 'high';
          }

          setTrustScore({
            score: baseScore,
            risk: risk,
            factors: {
              hasDID: loan.didVerified,
              transactionCount: 0
            }
          });
          setLoadingTrustScore(false);
          return;
        }

        const score = await calculateTrustScore(loan.borrower);
        setTrustScore(score);
      } catch (error) {
        console.error('Failed to fetch trust score:', error);
        // Fallback to the risk score from props with DID consideration
        const baseScore = loan.didVerified ? 10 : 0;
        setTrustScore({
          score: baseScore,
          risk: loan.riskScore,
          factors: {
            hasDID: loan.didVerified,
            transactionCount: 0
          }
        });
      } finally {
        setLoadingTrustScore(false);
      }
    };

    fetchTrustScore();
  }, [loan.borrower, loan.riskScore, loan.didVerified, isOwn]);
  
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTrustScoreDisplay = () => {
    if (loadingTrustScore) {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
          <span className="text-sm text-gray-500">Loading trust score...</span>
        </div>
      );
    }

    if (!trustScore) {
      return (
        <Badge className={getRiskColor(loan.riskScore)}>
          {loan.riskScore} risk
        </Badge>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Badge className={getRiskColor(trustScore.risk)}>
          {trustScore.risk} risk
        </Badge>
        <div className="text-xs text-gray-600 font-mono">
          Score: {trustScore.score}
        </div>
      </div>
    );
  };

  // Check if user has sufficient balance for funding
  const checkSufficientBalance = () => {
    const fundingAmount = 1; // Fixed funding amount for demo (reduced for testing)
    
    console.log('🔍 [LoanCard] Checking balance for loan:', loan.id);
    console.log('🔍 [LoanCard] User balances:', userBalances);
    console.log('🔍 [LoanCard] Funding amount needed:', fundingAmount);
    
    // Check RLUSD balance first (priority)
    const rlusdBalance = userBalances.find(balance => 
      balance.currency === 'RLUSD' && balance.issuer === 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV'
    );
    
    console.log('🔍 [LoanCard] Found RLUSD balance:', rlusdBalance);
    
    if (rlusdBalance && parseFloat(rlusdBalance.value) >= fundingAmount) {
      console.log('✅ [LoanCard] RLUSD balance sufficient:', parseFloat(rlusdBalance.value));
      return { canFund: true, currency: 'RLUSD', balance: parseFloat(rlusdBalance.value) };
    }
    
    // Check XRP balance as fallback
    const xrpBalance = userBalances.find(balance => balance.currency === 'XRP');
    
    console.log('🔍 [LoanCard] Found XRP balance:', xrpBalance);
    
    if (xrpBalance && parseFloat(xrpBalance.value) >= fundingAmount) {
      console.log('✅ [LoanCard] XRP balance sufficient:', parseFloat(xrpBalance.value));
      return { canFund: true, currency: 'XRP', balance: parseFloat(xrpBalance.value) };
    }
    
    console.log('❌ [LoanCard] Insufficient balance for funding');
    return { canFund: false, currency: null, balance: 0 };
  };

  const balanceCheck = checkSufficientBalance();

  return (
    <Card className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-800">
            ${loan.amount.toLocaleString()} RLUSD
          </CardTitle>
          <div className="flex items-center gap-2">
            {(trustScore?.factors.hasDID || loan.didVerified) && (
              <Shield className="w-4 h-4 text-green-600" />
            )}
            {getTrustScoreDisplay()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="w-4 h-4" />
          <span className="font-mono text-xs">{loan.borrower}</span>
          {(trustScore?.factors.hasDID || loan.didVerified) && <span className="text-green-600">(Verified)</span>}
        </div>
        
        {trustScore && !loadingTrustScore && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Info className="w-4 h-4" />
              <span>Trust Score Breakdown</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>DID Verified:</span>
                <span className={trustScore.factors.hasDID ? 'text-green-600' : 'text-red-600'}>
                  {trustScore.factors.hasDID ? '✓ +10' : '✗ +0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Transactions:</span>
                <span className="text-blue-600">
                  {trustScore.factors.transactionCount} (+{Math.min(Math.floor(trustScore.factors.transactionCount / 10), 20)})
                </span>
              </div>
              {trustScore.factors.accountAge && (
                <div className="flex justify-between col-span-2">
                  <span>Account Age Bonus:</span>
                  <span className="text-purple-600">
                    +{Math.min(Math.floor(trustScore.factors.accountAge / 50), 5)}
                  </span>
                </div>
              )}
              <div className="flex justify-between col-span-2 font-medium pt-1 border-t border-gray-200">
                <span>Total Score:</span>
                <span className={`${trustScore.risk === 'low' ? 'text-green-600' : trustScore.risk === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>
                  {trustScore.score}
                </span>
              </div>
            </div>
          </div>
        )}
        
        <p className="text-gray-700 line-clamp-2">{loan.purpose}</p>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span>{loan.interestRate}% APR</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>{loan.duration}</span>
          </div>
        </div>
        
        {loan.status !== 'completed' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Funding Progress</span>
              <span>${loan.fundedAmount.toLocaleString()} / ${loan.amount.toLocaleString()}</span>
            </div>
            <Progress value={fundingProgress} className="h-2" />
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        {!isOwn && loan.status === 'active' && fundingProgress < 100 && (
          <Button 
            onClick={() => onFund?.(loan.id)}
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={!balanceCheck.canFund}
          >
            {!balanceCheck.canFund 
              ? 'Insufficient Balance' 
              : `Fund This Loan (${balanceCheck.currency})`
            }
          </Button>
        )}
        {loan.status === 'funded' && (
          <Badge variant="secondary" className="w-full justify-center">
            Fully Funded
          </Badge>
        )}
        {loan.status === 'completed' && (
          <Badge variant="outline" className="w-full justify-center">
            Completed
          </Badge>
        )}
      </CardFooter>
    </Card>
  );
};
