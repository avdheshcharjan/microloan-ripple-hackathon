
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, CheckCircle } from 'lucide-react';
import { XRPLWallet, createRLUSDTrustLine, checkTrustLineExists } from '@/utils/xrplClient';
import { Wallet as XRPLWalletClass } from 'xrpl';

interface RLUSDTrustLineProps {
  userWallet: XRPLWallet;
  onTrustLineCreated: () => void;
}

export const RLUSDTrustLine: React.FC<RLUSDTrustLineProps> = ({ 
  userWallet, 
  onTrustLineCreated 
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [hasTrustLine, setHasTrustLine] = useState(false);
  const { toast } = useToast();

  const checkExistingTrustLine = async () => {
    try {
      const exists = await checkTrustLineExists(
        userWallet.address, 
        'RLUSD', 
        'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'
      );
      setHasTrustLine(exists);
    } catch (error) {
      console.error('Failed to check trust line:', error);
    }
  };

  React.useEffect(() => {
    checkExistingTrustLine();
  }, [userWallet.address]);

  const handleCreateTrustLine = async () => {
    setIsCreating(true);
    try {
      const wallet = XRPLWalletClass.fromSeed(userWallet.seed);
      const txHash = await createRLUSDTrustLine(wallet);
      
      toast({
        title: "Trust Line Created",
        description: `RLUSD trust line created successfully. TX: ${txHash.slice(0, 8)}...`,
      });

      setHasTrustLine(true);
      onTrustLineCreated();
    } catch (error) {
      console.error('Trust line creation failed:', error);
      toast({
        title: "Trust Line Failed",
        description: "There was an error creating the RLUSD trust line. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (hasTrustLine) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            RLUSD Trust Line Active
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <DollarSign className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Ready to receive RLUSD</p>
              <p className="text-sm text-green-600">
                Your wallet can now send and receive Ripple USD tokens.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Create RLUSD Trust Line
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800 font-medium mb-1">Trust Line Required</p>
            <p className="text-xs text-yellow-700">
              To receive RLUSD tokens, you need to create a trust line first. This is a one-time setup.
            </p>
          </div>
          
          <Button 
            onClick={handleCreateTrustLine}
            disabled={isCreating}
            className="w-full"
          >
            {isCreating ? 'Creating Trust Line...' : 'Create RLUSD Trust Line'}
          </Button>
          
          <div className="text-xs text-gray-500">
            <p>• Trust lines allow your wallet to hold specific tokens</p>
            <p>• This is required before receiving any RLUSD payments</p>
            <p>• Small XRP fee (typically ~0.2 XRP) required</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
