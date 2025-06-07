import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Shield, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import { XRPLWallet, getAccountBalances, connectXRPL } from '@/utils/xrplClient';
import { Wallet as XRPLWalletClass } from 'xrpl';
import { setupRLUSDTrustLine } from '@/utils/rlusdUtils';

interface SeedConnectionProps {
  isConnecting: boolean;
  onConnectionStart: () => void;
  onConnectionEnd: () => void;
  onWalletConnected: (walletInfo: XRPLWallet) => void;
}

export const SeedConnection: React.FC<SeedConnectionProps> = ({
  isConnecting,
  onConnectionStart,
  onConnectionEnd,
  onWalletConnected
}) => {
  const [seed, setSeed] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  const [hasReadWarning, setHasReadWarning] = useState(false);
  const { toast } = useToast();

  const handleConnectWithSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!seed.trim()) {
      toast({
        title: "Seed Required",
        description: "Please enter your wallet seed to connect.",
        variant: "destructive",
      });
      return;
    }

    if (!hasReadWarning) {
      toast({
        title: "Security Warning",
        description: "Please read and acknowledge the security warning before proceeding.",
        variant: "destructive",
      });
      return;
    }


    onConnectionStart();

    try {
      await connectXRPL();
      
      const wallet = XRPLWalletClass.fromSeed(seed.trim());
      
      // Fetching account balances...
      const balances = await getAccountBalances(wallet.address);
      const xrpBalance = balances.find(b => b.currency === 'XRP')?.value || '0';

      const walletInfo: XRPLWallet = {
        address: wallet.address,
        seed: seed.trim(),
        balance: xrpBalance
      };

      // Seed connection successful

      toast({
        title: "🎉 Wallet Connected Successfully",
        description: `Connected to wallet: ${wallet.address.slice(0, 8)}...${wallet.address.slice(-4)}`,
      });

      onWalletConnected(walletInfo);

      // Auto-setup RLUSD trust line for seed-based connections
      setTimeout(() => {
        // Setting up RLUSD trust line...
        setupRLUSDTrustLine(walletInfo, toast);
      }, 2000);
      
      // Clear the seed from state for security
      setSeed('');
      
    } catch (error) {
      console.error('❌ Seed connection failed:', error);
      
      let errorTitle = "Connection Failed";
      let errorDescription = "Invalid seed or wallet not found on XRPL.";
      
      if (error instanceof Error) {
        if (error.message.includes('checksum')) {
          errorTitle = "Invalid Seed Format";
          errorDescription = "The seed format is invalid. Please check your seed and try again.";
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
          errorTitle = "Network Error";
          errorDescription = "Unable to connect to XRPL network. Please check your connection and try again.";
        } else if (error.message.includes('not found') || error.message.includes('unfunded')) {
          errorTitle = "Wallet Not Found";
          errorDescription = "This wallet doesn't exist on the XRPL or has no XRP balance.";
        }
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      onConnectionEnd();
    }
  };

  const toggleSeedVisibility = () => {
    setShowSeed(!showSeed);
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Security Warning */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-red-800">
              🔒 Critical Security Warning
            </h4>
            <div className="text-xs text-red-700 space-y-1">
              <p>• Never share your seed phrase with anyone</p>
              <p>• Anyone with your seed has full access to your wallet</p>
              <p>• This connection method should only be used temporarily</p>
              <p>• Consider using Crossmark extension for better security</p>
              <p>• Make sure you're on the correct website</p>
            </div>
            <label className="flex items-center space-x-2 mt-2">
              <input
                type="checkbox"
                checked={hasReadWarning}
                onChange={(e) => setHasReadWarning(e.target.checked)}
                className="w-4 h-4 text-red-600"
              />
              <span className="text-xs text-red-800 font-medium">
                I understand the risks and have verified this is the correct website
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Connection Form */}
      <form onSubmit={handleConnectWithSeed} className="space-y-4">
        <div>
          <Label htmlFor="seed" className="flex items-center space-x-2">
            <Lock className="w-4 h-4" />
            <span>Wallet Seed Phrase</span>
          </Label>
          <div className="relative mt-2">
            <Input
              id="seed"
              type={showSeed ? "text" : "password"}
              placeholder="Enter your XRPL wallet seed phrase"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              required
              disabled={!hasReadWarning}
              className="pr-10"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={toggleSeedVisibility}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              disabled={!hasReadWarning}
            >
              {showSeed ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-600 flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>Your seed is processed locally and never stored</span>
            </p>
            <p className="text-xs text-gray-500">
              💡 Tip: Your seed is typically 12-24 words or a long string starting with 's'
            </p>
          </div>
        </div>

        <Button 
          type="submit"
          disabled={isConnecting || !hasReadWarning || !seed.trim()}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
          size="lg"
        >
          {isConnecting ? (
            <span className="flex items-center space-x-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              <span>Connecting...</span>
            </span>
          ) : (
            'Connect with Seed'
          )}
        </Button>
      </form>

      {/* Additional Security Tips */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-orange-800">
            <p className="font-medium mb-1">🛡️ Security Best Practices:</p>
            <ul className="space-y-0.5 list-disc list-inside ml-2">
              <li>Use this method only as a temporary fallback</li>
              <li>Clear your browser data after use</li>
              <li>Use a hardware wallet for large amounts</li>
              <li>Consider moving funds to a more secure wallet</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Fallback Notice */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          Having trouble with Crossmark? This is a secure fallback method.
        </p>
        <p className="text-xs text-green-600 mt-1">
          ✅ All operations happen locally in your browser
        </p>
      </div>
    </div>
  );
};
