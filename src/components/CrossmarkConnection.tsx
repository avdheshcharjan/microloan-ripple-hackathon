import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink } from 'lucide-react';
import { XRPLWallet, getAccountBalances, connectXRPL } from '@/utils/xrplClient';
import { setupRLUSDTrustLine } from '@/utils/rlusdUtils';
import sdk from "@crossmarkio/sdk";

interface CrossmarkConnectionProps {
  isConnecting: boolean;
  onConnectionStart: () => void;
  onConnectionEnd: () => void;
  onWalletConnected: (walletInfo: XRPLWallet) => void;
}

export const CrossmarkConnection: React.FC<CrossmarkConnectionProps> = ({
  isConnecting,
  onConnectionStart,
  onConnectionEnd,
  onWalletConnected
}) => {
  const { toast } = useToast();

  const signInAndWait = async (): Promise<string> => {
    try {
      const response = await sdk.async.signInAndWait();
      return response.response.data.address;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const getUserSession = async (): Promise<string | null> => {
    return sdk.session.user?.id || null;
  };

  const signTransaction = async (address: string, destination: string, amount: string): Promise<string> => {
    const response = await sdk.async.signAndWait({
      TransactionType: "Payment",
      Account: address,
      Destination: destination,
      Amount: amount,
    });
    return response.response.data.txBlob;
  };

  const submitTransaction = async (address: string, txBlob: string): Promise<string> => {
    const response = await sdk.async.submitAndWait(address, txBlob);
    return response.response.data.resp.result.hash;
  };

  const handleConnectCrossmark = async () => {
    onConnectionStart();

    try {
      console.log('Attempting to sign in with Crossmark...');
      const address = await signInAndWait();

      if (!address) {
        throw new Error('Failed to get address from Crossmark');
      }

      // Verify session
      const sessionId = await getUserSession();
      console.log('Session ID:', sessionId);

      await handleSuccessfulConnection(address);

    } catch (error) {
      console.error('Crossmark connection error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to Crossmark";

      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      onConnectionEnd();
    }
  };

  // Helper function to handle successful connection
  const handleSuccessfulConnection = async (address: string) => {
    console.log('Successfully got address:', address);

    // Connect to XRPL and verify wallet
    await connectXRPL();

    const balances = await getAccountBalances(address);
    const xrpBalance = balances.find(b => b.currency === 'XRP')?.value || '0';

    const walletInfo: XRPLWallet = {
      address: address,
      seed: '', // Crossmark doesn't expose seed
      balance: xrpBalance,
      signTransaction: async (destination: string, amount: string) => {
        return signTransaction(address, destination, amount);
      },
      submitTransaction: async (txBlob: string) => {
        return submitTransaction(address, txBlob);
      }
    };

    toast({
      title: "Wallet Connected",
      description: `Successfully connected to Crossmark wallet`,
    });

    onWalletConnected(walletInfo);

    // Auto-setup RLUSD trust line for Crossmark connections
    setTimeout(() => setupRLUSDTrustLine(walletInfo, toast), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 text-center">
        Connect using Crossmark browser extension
      </p>
      <Button
        onClick={handleConnectCrossmark}
        disabled={isConnecting}
        className="w-full bg-green-600 hover:bg-green-700"
        size="lg"
      >
        {isConnecting ? 'Connecting...' : 'Connect Crossmark Wallet'}
      </Button>
      <p className="text-xs text-gray-500 text-center">
        Don't have Crossmark? <a href="https://crossmark.io" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">Download here</a>
      </p>
      <p className="text-xs text-orange-600 text-center">
        Make sure Crossmark is unlocked and you're signed in before connecting
      </p>
    </div>
  );
};
