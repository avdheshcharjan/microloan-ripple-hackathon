import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, RefreshCw, DollarSign } from 'lucide-react';
import { XRPLWallet, getAccountBalances, AccountBalance } from '@/utils/xrplClient';

interface WalletBalancesProps {
  userWallet: XRPLWallet;
  onRefresh?: () => void;
  hasRLUSDTrustLine: boolean;
  onTrustLineCreated: () => void;
}

export const WalletBalances: React.FC<WalletBalancesProps> = ({ 
  userWallet, 
  onRefresh, 
  hasRLUSDTrustLine, 
  onTrustLineCreated 
}) => {
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalances = async () => {
    setIsLoading(true);
    try {
      const accountBalances = await getAccountBalances(userWallet.address);
      setBalances(accountBalances);
      onRefresh?.();
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [userWallet.address]);

  const formatBalance = (balance: AccountBalance) => {
    const value = parseFloat(balance.value);
    if (value === 0) return '0';
    if (value < 0.001) return value.toFixed(6);
    return value.toFixed(3);
  };

  const getTokenIcon = (currency: string) => {
    if (currency === 'XRP') {
      return <Coins className="w-4 h-4 text-blue-600" />;
    } else if (currency === 'RLUSD' || currency.includes('USD')) {
      return <DollarSign className="w-4 h-4 text-green-600" />;
    }
    return <Coins className="w-4 h-4 text-purple-600" />;
  };

  const getTokenBgColor = (currency: string) => {
    if (currency === 'XRP') {
      return 'bg-blue-100';
    } else if (currency === 'RLUSD' || currency.includes('USD')) {
      return 'bg-green-100';
    }
    return 'bg-purple-100';
  };

  const getTokenBadgeColor = (currency: string) => {
    if (currency === 'XRP') {
      return 'bg-blue-200 text-blue-800';
    } else if (currency === 'RLUSD' || currency.includes('USD')) {
      return 'bg-green-200 text-green-800';
    }
    return 'bg-purple-200 text-purple-800';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Wallet Balances
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBalances}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {balances.map((balance, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${getTokenBgColor(balance.currency)}`}>
                  {getTokenIcon(balance.currency)}
                </div>
                <div>
                  <p className="font-medium">{balance.currency}</p>
                  {balance.issuer && (
                    <p className="text-xs text-gray-600 font-mono">
                      Issuer: {balance.issuer.slice(0, 8)}...{balance.issuer.slice(-8)}
                    </p>
                  )}
                  {balance.currency === 'XRP' && (
                    <p className="text-xs text-gray-500">Native XRPL token</p>
                  )}
                  {balance.currency === 'RLUSD' && (
                    <p className="text-xs text-gray-500">Ripple USD Stablecoin</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg">{formatBalance(balance)}</p>
                <Badge className={`text-xs ${getTokenBadgeColor(balance.currency)}`}>
                  {balance.currency}
                </Badge>
              </div>
            </div>
          ))}
          {balances.length === 0 && (
            <div className="text-center py-8">
              <Coins className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No balances to display</p>
              <p className="text-sm text-gray-400">Your token balances will appear here</p>
            </div>
          )}
          
          {/* Info section for getting tokens */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 font-medium mb-1">Need RLUSD?</p>
            <p className="text-xs text-blue-600">
              Visit the Get RLUSD button in the header to get Ripple USD tokens for testing.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
