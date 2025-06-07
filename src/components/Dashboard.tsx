import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, DollarSign, Users, Clock, ArrowUpRight, ArrowDownLeft, Wallet, Shield, User, Copy, ExternalLink, Hash, Star, Loader2 } from 'lucide-react';
import { XRPLWallet, createDIDTransaction, calculateTrustScore, TrustScore } from '@/utils/xrplClient';
import { Wallet as XRPLWalletClass } from 'xrpl';
import { SendPayment } from '@/components/SendPayment';
import { ReceivePayment } from '@/components/ReceivePayment';
import { WalletBalances } from '@/components/WalletBalances';

interface DashboardProps {
  userStats: {
    totalLent: number;
    totalBorrowed: number;
    activeLoans: number;
    completedLoans: number;
    portfolioReturn: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    hash?: string;
    date: string;
    account?: string;
    destination?: string;
  }>;
  userWallet?: XRPLWallet;
  didTransactionHash: string;
  onDIDCreated?: (txHash: string) => void;
  showWalletDetails?: boolean;
  onTransactionUpdate?: () => void;
  hasRLUSDTrustLine: boolean;
  onTrustLineCreated: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  userStats, 
  recentActivity, 
  userWallet, 
  didTransactionHash, 
  onDIDCreated,
  showWalletDetails = false,
  onTransactionUpdate,
  hasRLUSDTrustLine,
  onTrustLineCreated 
}) => {
  const [didData, setDidData] = useState({ fullName: '', phone: '' });
  const [isCreatingDID, setIsCreatingDID] = useState(false);
  const [userTrustScore, setUserTrustScore] = useState<TrustScore | null>(null);
  const [loadingTrustScore, setLoadingTrustScore] = useState(false);
  const { toast } = useToast();

  // Fetch user's Trust Score
  useEffect(() => {
    const fetchUserTrustScore = async () => {
      if (!userWallet) return;
      
      try {
        setLoadingTrustScore(true);
        const score = await calculateTrustScore(userWallet.address);
        setUserTrustScore(score);
      } catch (error) {
        console.error('Failed to fetch user trust score:', error);
      } finally {
        setLoadingTrustScore(false);
      }
    };

    fetchUserTrustScore();
  }, [userWallet, didTransactionHash]); // Re-fetch when DID is created

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const handleCreateDID = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userWallet) return;

    // Validate input fields
    if (!didData.fullName.trim() || !didData.phone.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both name and phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingDID(true);
    
    // Show immediate feedback
    toast({
      title: "Creating DID",
      description: "Submitting your DID verification to XRPL...",
    });

    try {
      const wallet = XRPLWalletClass.fromSeed(userWallet.seed);
      
      // Add a timeout to prevent infinite hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Transaction timeout')), 30000); // 30 second timeout
      });
      
      const didPromise = createDIDTransaction(wallet, didData);
      
      const txHash = await Promise.race([didPromise, timeoutPromise]);
      
      toast({
        title: "DID Created Successfully",
        description: "Your decentralized identity has been created on XRPL.",
      });

      onDIDCreated?.(txHash);
      
      // Clear form
      setDidData({ fullName: '', phone: '' });
      
    } catch (error) {
      console.error('DID creation failed:', error);
      
      let errorMessage = "There was an error creating your DID. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = "DID creation timed out. Please check your connection and try again.";
        } else if (error.message.includes('insufficient')) {
          errorMessage = "Insufficient XRP balance. Please ensure you have at least 1 XRP in your wallet.";
        } else if (error.message.includes('connect')) {
          errorMessage = "Connection to XRPL network failed. Please try again.";
        }
      }
      
      toast({
        title: "DID Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreatingDID(false);
    }
  };

  const handlePaymentSent = () => {
    onTransactionUpdate?.();
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'received':
        return <ArrowDownLeft className="w-4 h-4 text-green-600" />;
      case 'sent':
        return <ArrowUpRight className="w-4 h-4 text-red-600" />;
      case 'did_verification':
        return <Shield className="w-4 h-4 text-blue-600" />;
      case 'loan_funding':
        return <DollarSign className="w-4 h-4 text-purple-600" />;
      case 'nft_mint':
        return <Hash className="w-4 h-4 text-orange-600" />;
      default:
        return <Hash className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTransactionBgColor = (type: string) => {
    switch (type) {
      case 'received':
        return 'bg-green-100';
      case 'sent':
        return 'bg-red-100';
      case 'did_verification':
        return 'bg-blue-100';
      case 'loan_funding':
        return 'bg-purple-100';
      case 'nft_mint':
        return 'bg-orange-100';
      default:
        return 'bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallet Details Section - Always show if wallet exists */}
      {userWallet && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Wallet Operations */}
          <div className="space-y-6">
            <Tabs defaultValue="balances" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="balances">Balances</TabsTrigger>
                <TabsTrigger value="send">Send</TabsTrigger>
                <TabsTrigger value="receive">Receive</TabsTrigger>
              </TabsList>
              
              <TabsContent value="balances">
                <WalletBalances 
                  userWallet={userWallet} 
                  onRefresh={onTransactionUpdate}
                  hasRLUSDTrustLine={hasRLUSDTrustLine}
                  onTrustLineCreated={onTrustLineCreated}
                />
              </TabsContent>
              
              <TabsContent value="send">
                <SendPayment 
                  userWallet={userWallet}
                  onPaymentSent={handlePaymentSent}
                />
              </TabsContent>
              
              <TabsContent value="receive">
                <ReceivePayment userWallet={userWallet} />
              </TabsContent>
            </Tabs>
          </div>

          {/* DID Section */}
          <Card className={`border-l-4 ${didTransactionHash ? 'border-l-green-500' : 'border-l-orange-500'}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Decentralized Identity (DID)
                {didTransactionHash && (
                  <Badge variant="secondary" className="ml-2">Created</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {didTransactionHash ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm font-medium">DID Verified on XRPL</span>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Transaction Hash</Label>
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg mt-1">
                      <span className="text-sm font-mono text-gray-800 flex-1 break-all">
                        {didTransactionHash}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => copyToClipboard(didTransactionHash, 'Transaction hash')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => window.open(`https://testnet.xrpl.org/transactions/${didTransactionHash}`, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateDID} className="space-y-4">
                  <div className="text-center mb-4">
                    <User className="w-12 h-12 text-orange-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Create your DID to enhance loan credibility</p>
                  </div>
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      placeholder="Enter your full name"
                      value={didData.fullName}
                      onChange={(e) => setDidData({ ...didData, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter your phone number"
                      value={didData.phone}
                      onChange={(e) => setDidData({ ...didData, phone: e.target.value.replace(/[^0-9]/g, '') })}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isCreatingDID || !didData.fullName.trim() || !didData.phone.trim()}
                    className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400"
                  >
                    {isCreatingDID ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating DID...
                      </div>
                    ) : 'Create DID'}
                  </Button>
                  
                  {isCreatingDID && (
                    <p className="text-xs text-center text-gray-500 mt-2">
                      This may take up to 30 seconds. Please wait...
                    </p>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Trust Score Card */}
        <Card className={`border-l-4 ${
          userTrustScore?.risk === 'low' ? 'border-l-green-500' : 
          userTrustScore?.risk === 'medium' ? 'border-l-yellow-500' : 
          'border-l-red-500'
        }`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Trust Score</CardTitle>
            <Star className={`w-4 h-4 ${
              userTrustScore?.risk === 'low' ? 'text-green-600' : 
              userTrustScore?.risk === 'medium' ? 'text-yellow-600' : 
              'text-red-600'
            }`} />
          </CardHeader>
          <CardContent>
            {loadingTrustScore ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-gray-500">Loading...</span>
              </div>
            ) : userTrustScore ? (
              <>
                <div className={`text-2xl font-bold ${
                  userTrustScore.risk === 'low' ? 'text-green-700' : 
                  userTrustScore.risk === 'medium' ? 'text-yellow-700' : 
                  'text-red-700'
                }`}>
                  {userTrustScore.score}
                </div>
                <p className={`text-xs mt-1 capitalize ${
                  userTrustScore.risk === 'low' ? 'text-green-600' : 
                  userTrustScore.risk === 'medium' ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {userTrustScore.risk} Risk
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold text-gray-400">--</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Lent</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              ${userStats.totalLent.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">RLUSD</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Borrowed</CardTitle>
            <ArrowDownLeft className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              ${userStats.totalBorrowed.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">RLUSD</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Loans</CardTitle>
            <Clock className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {userStats.activeLoans}
            </div>
            <p className="text-xs text-gray-500 mt-1">In Progress</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Portfolio Return</CardTitle>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {userStats.portfolioReturn}%
            </div>
            <p className="text-xs text-gray-500 mt-1">Annual Return</p>
          </CardContent>
        </Card>
      </div>

      {/* Trust Score Breakdown */}
      {userTrustScore && !loadingTrustScore && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Trust Score Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">Score Breakdown</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm">DID Verification</span>
                    <span className={`font-semibold ${userTrustScore.factors.hasDID ? 'text-green-600' : 'text-red-600'}`}>
                      {userTrustScore.factors.hasDID ? '✓ +10 points' : '✗ +0 points'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm">Transaction History</span>
                    <span className="font-semibold text-blue-600">
                      {userTrustScore.factors.transactionCount} txs (+{Math.min(Math.floor(userTrustScore.factors.transactionCount / 10), 20)} points)
                    </span>
                  </div>
                  {userTrustScore.factors.accountAge && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm">Account Age Bonus</span>
                      <span className="font-semibold text-purple-600">
                        +{Math.min(Math.floor(userTrustScore.factors.accountAge / 50), 5)} points
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border-t-2 border-gray-300">
                    <span className="font-semibold">Total Trust Score</span>
                    <span className={`font-bold text-lg ${
                      userTrustScore.risk === 'low' ? 'text-green-600' : 
                      userTrustScore.risk === 'medium' ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {userTrustScore.score} points
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">How to Improve</h4>
                <div className="space-y-3">
                  {!userTrustScore.factors.hasDID && (
                    <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                      <Shield className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-800">Create a DID</p>
                        <p className="text-sm text-orange-700">Add +10 points by verifying your identity</p>
                      </div>
                    </div>
                  )}
                  {userTrustScore.factors.transactionCount < 100 && (
                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                      <Hash className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-800">Increase Activity</p>
                        <p className="text-sm text-blue-700">More XRPL transactions improve your score</p>
                      </div>
                    </div>
                  )}
                  <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                    <p className="text-sm text-green-700">
                      <strong>Risk Level:</strong> {userTrustScore.risk.charAt(0).toUpperCase() + userTrustScore.risk.slice(1)} - {
                        userTrustScore.risk === 'low' ? 'Excellent creditworthiness' :
                        userTrustScore.risk === 'medium' ? 'Good standing with room for improvement' :
                        'Higher risk profile - focus on building trust'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform Impact */}
      <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Platform Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-700">2,547</div>
              <p className="text-sm text-gray-600">Lives Impacted</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-700">$1.2M</div>
              <p className="text-sm text-gray-600">Total Loans Funded</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-700">94%</div>
              <p className="text-sm text-gray-600">Repayment Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent XRPL Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent XRPL Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getTransactionBgColor(activity.type)}`}>
                      {getTransactionIcon(activity.type)}
                    </div>
                    <div>
                      <p className="font-medium">{activity.description}</p>
                      {activity.hash && (
                        <p className="text-sm text-gray-600 font-mono">
                          {activity.hash.slice(0, 8)}...{activity.hash.slice(-8)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {activity.amount > 0 && (
                      <p className="font-semibold">{activity.amount.toFixed(6)} XRP</p>
                    )}
                    <p className="text-sm text-gray-500">{activity.date}</p>
                    {activity.hash && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 mt-1"
                        onClick={() => window.open(`https://testnet.xrpl.org/transactions/${activity.hash}`, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Hash className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No transactions yet</p>
                <p className="text-sm text-gray-400">Your XRPL transactions will appear here</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
