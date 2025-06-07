
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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

    onConnectionStart();

    try {
      await connectXRPL();
      
      const wallet = XRPLWalletClass.fromSeed(seed.trim());
      
      const balances = await getAccountBalances(wallet.address);
      const xrpBalance = balances.find(b => b.currency === 'XRP')?.value || '0';

      const walletInfo: XRPLWallet = {
        address: wallet.address,
        seed: seed.trim(),
        balance: xrpBalance
      };

      toast({
        title: "Wallet Connected",
        description: `Connected to wallet: ${wallet.address.slice(0, 8)}...`,
      });

      onWalletConnected(walletInfo);

      // Auto-setup RLUSD trust line for seed-based connections
      setTimeout(() => setupRLUSDTrustLine(walletInfo, toast), 2000);
    } catch (error) {
      console.error('Wallet connection failed:', error);
      toast({
        title: "Connection Failed",
        description: "Invalid seed or wallet not found on XRPL.",
        variant: "destructive",
      });
    } finally {
      onConnectionEnd();
    }
  };

  return (
    <form onSubmit={handleConnectWithSeed} className="space-y-4">
      <div>
        <Label htmlFor="seed">Wallet Seed</Label>
        <Input
          id="seed"
          type="password"
          placeholder="Enter your XRPL wallet seed"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Your seed is used locally and never stored on our servers
        </p>
      </div>

      <Button 
        type="submit"
        disabled={isConnecting}
        className="w-full bg-green-600 hover:bg-green-700"
        size="lg"
      >
        {isConnecting ? 'Connecting...' : 'Connect with Seed'}
      </Button>
    </form>
  );
};
