
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Zap, Eye, EyeOff, Copy } from 'lucide-react';
import { createXRPLWallet, XRPLWallet } from '@/utils/xrplClient';

interface WalletCreationProps {
  hasWallet: boolean;
  onWalletCreated: (walletInfo: XRPLWallet) => void;
}

export const WalletCreation: React.FC<WalletCreationProps> = ({ hasWallet, onWalletCreated }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [createdWallet, setCreatedWallet] = useState<XRPLWallet | null>(null);
  const [showSeed, setShowSeed] = useState(false);
  const { toast } = useToast();

  const handleCreateWallet = async () => {
    setIsCreating(true);

    try {
      toast({
        title: "Creating XRPL Wallet",
        description: "Generating your wallet on the XRP Ledger...",
      });

      const walletInfo = await createXRPLWallet();
      
      toast({
        title: "Wallet Created Successfully",
        description: `Wallet funded with ${walletInfo.balance} XRP`,
      });

      setCreatedWallet(walletInfo);
    } catch (error) {
      console.error('Wallet creation failed:', error);
      toast({
        title: "Wallet Creation Failed",
        description: "There was an error creating your wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleContinue = () => {
    if (createdWallet) {
      onWalletCreated(createdWallet);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  if (createdWallet) {
    return (
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <Wallet className="w-5 h-5" />
            Wallet Created Successfully!
          </CardTitle>
          <p className="text-sm text-gray-600">
            Your XRPL wallet has been created. Save your seed phrase securely.
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Wallet Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Wallet Address</label>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-mono text-blue-800 flex-1 break-all">
                {createdWallet.address}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => copyToClipboard(createdWallet.address, 'Wallet address')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Seed Phrase */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Seed Phrase</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSeed(!showSeed)}
                className="text-gray-500 hover:text-gray-700"
              >
                {showSeed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showSeed ? 'Hide' : 'Show'}
              </Button>
            </div>
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <span className="text-sm font-mono text-yellow-800 flex-1 break-all">
                {showSeed ? createdWallet.seed : '••••••••••••••••••••••••••••••'}
              </span>
              {showSeed && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => copyToClipboard(createdWallet.seed, 'Seed phrase')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-yellow-600">
              ⚠️ Keep your seed phrase safe and private. Anyone with access to it can control your wallet.
            </p>
          </div>

          {/* Balance */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Balance</label>
            <div className="p-3 bg-green-50 rounded-lg">
              <span className="text-lg font-semibold text-green-800">
                {createdWallet.balance} XRP
              </span>
              <p className="text-xs text-green-600 mt-1">Test network funds</p>
            </div>
          </div>

          {/* Continue Button */}
          <Button onClick={handleContinue} className="w-full bg-blue-600 hover:bg-blue-700">
            Continue to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Create New Wallet
        </CardTitle>
        <p className="text-sm text-gray-600">
          Generate a new wallet on the XRP Ledger with testnet funding
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-full mx-auto mb-3 flex items-center justify-center">
              <Zap className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold">New to XRPL?</h3>
            <p className="text-gray-600">
              Create a new wallet with testnet XRP for immediate use
            </p>
          </div>

          <Button 
            onClick={handleCreateWallet}
            disabled={isCreating}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {isCreating ? 'Creating Wallet...' : 'Create New Wallet'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
