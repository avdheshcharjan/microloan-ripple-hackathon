import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink } from 'lucide-react';
import { XRPLWallet, getAccountBalances, connectXRPL } from '@/utils/xrplClient';
import { setupRLUSDTrustLine } from '@/utils/rlusdUtils';

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

  const waitForCrossmark = async (timeout = 5000): Promise<any> => {
    const startTime = Date.now();
    
    // First check if MetaMask is modifying the provider
    if ((window as any).ethereum) {
      console.log('MetaMask detected, checking for provider conflicts...');
    }
    
    while (Date.now() - startTime < timeout) {
      // Check both window.crossmark and ethereum.crossmark
      const crossmarkProvider = (window as any).crossmark || 
                              ((window as any).ethereum && (window as any).ethereum.crossmark);
      
      if (crossmarkProvider) {
        console.log('Crossmark provider found:', crossmarkProvider);
        return crossmarkProvider;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Crossmark not found after waiting');
  };

  const handleConnectCrossmark = async () => {
    onConnectionStart();

    try {
      console.log('Checking for wallet providers...');
      console.log('MetaMask:', (window as any).ethereum);
      console.log('Direct Crossmark:', (window as any).crossmark);
      
      const crossmark = await waitForCrossmark();
      console.log('Crossmark instance:', crossmark);
      
      if (!crossmark) {
        // Try alternative detection methods
        console.log('Checking all window providers:', {
          ethereum: (window as any).ethereum,
          xrpl: (window as any).xrpl,
          xumm: (window as any).xumm,
          crossmark: (window as any).crossmark
        });
        
        toast({
          title: "Crossmark Not Detected",
          description: "MetaMask might be interfering with Crossmark. Try disabling MetaMask temporarily.",
          variant: "destructive",
        });

        const shouldTryFix = confirm(
          "Crossmark detection issues. Please try:\n" +
          "1. Disable MetaMask temporarily\n" +
          "2. Refresh the page\n" +
          "3. Enable Crossmark\n" +
          "\nWould you like to visit the Crossmark installation page to verify your installation?"
        );
        
        if (shouldTryFix) {
          window.open('https://crossmark.io', '_blank');
        }
        return;
      }

      console.log('Crossmark found, checking API methods:', Object.keys(crossmark));

      // Add MetaMask state check
      if ((window as any).ethereum?.isMetaMask) {
        console.log('MetaMask is active, attempting to work alongside it...');
      }

      // Try to initialize first
      try {
        console.log('Attempting to initialize Crossmark...');
        await crossmark.mount();
        console.log('Crossmark mounted successfully');
      } catch (error) {
        console.log('Mount not needed or failed:', error);
      }

      // Try using app methods first
      if (crossmark.app) {
        try {
          console.log('Using app API...');
          const response = await crossmark.app.getAddress();
          console.log('App response:', response);
          
          if (response && typeof response === 'string' && response.startsWith('r')) {
            await handleSuccessfulConnection(response);
            return;
          }
        } catch (error) {
          console.log('App method failed:', error);
        }
      }

      // Try using methods API
      if (crossmark.methods) {
        try {
          console.log('Using methods API...');
          const response = await crossmark.methods.address();
          console.log('Methods response:', response);
          
          if (response && typeof response === 'string' && response.startsWith('r')) {
            await handleSuccessfulConnection(response);
            return;
          }
        } catch (error) {
          console.log('Methods API failed:', error);
        }
      }

      // Try using session
      if (crossmark.session) {
        try {
          console.log('Using session API...');
          const address = await crossmark.session.address();
          console.log('Session address:', address);
          
          if (typeof address === 'string' && address.startsWith('r')) {
            await handleSuccessfulConnection(address);
            return;
          }
        } catch (error) {
          console.log('Session API failed:', error);
        }
      }

      // If we get here, try to connect explicitly
      try {
        console.log('Attempting explicit connect...');
        const response = await crossmark.methods.connect();
        console.log('Connect response:', response);
        
        if (response && typeof response === 'string' && response.startsWith('r')) {
          await handleSuccessfulConnection(response);
          return;
        }
      } catch (error) {
        console.log('Connect attempt failed:', error);
      }

      // If we get here, no method worked
      throw new Error(
        'Could not connect to Crossmark. Please ensure Crossmark is unlocked and you approve the connection request in the extension popup.'
      );

    } catch (error) {
      console.error('Crossmark connection error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to Crossmark";
      
      // Add MetaMask-specific error message
      const finalMessage = (window as any).ethereum?.isMetaMask 
        ? `${errorMessage}. Try disabling MetaMask temporarily and refresh the page.`
        : errorMessage;
      
      toast({
        title: "Connection Failed",
        description: finalMessage,
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
      balance: xrpBalance
    };

    toast({
      title: "Wallet Connected",
      description: `Successfully connected to Crossmark wallet`,
    });

    onWalletConnected(walletInfo);

    // Auto-setup RLUSD trust line for Crossmark connections (will show manual instruction)
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
