import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, AlertTriangle } from 'lucide-react';
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

  const waitForCrossmark = async (timeout = 10000): Promise<any> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const crossmarkProvider = (window as any).crossmark || 
                               ((window as any).ethereum && (window as any).ethereum.crossmark);
      
      if (crossmarkProvider) {
  
        return crossmarkProvider;
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    throw new Error('Crossmark not found after waiting');
  };

  const handleConnectCrossmark = async () => {

    onConnectionStart();

    try {
      // Show MetaMask warning if detected
      if ((window as any).ethereum?.isMetaMask) {
        toast({
          title: "MetaMask Detected",
          description: "If connection fails, try temporarily disabling MetaMask.",
          variant: "default",
        });
      }
      
      const crossmark = await waitForCrossmark();
      
      if (!crossmark) {
        await handleCrossmarkNotFound();
        return;
      }

      // Step 1: Connect to Crossmark
      if (!crossmark.methods?.connect) {
        throw new Error('Crossmark connect method not available');
      }


      const connectResponse = await crossmark.methods.connect();
      
      if (connectResponse !== true) {
        throw new Error('Failed to connect to Crossmark');
      }

      // Step 2: Sign in to get user address
      if (!crossmark.methods?.signInAndWait) {
        throw new Error('Crossmark signInAndWait method not available');
      }

      
      const signInResult = await crossmark.methods.signInAndWait();
      
      // Extract address from the response
      let address = null;
      if (signInResult?.response?.data?.address) {
        address = signInResult.response.data.address;
      } else if (signInResult?.response?.address) {
        address = signInResult.response.address;
      } else if (signInResult?.address) {
        address = signInResult.address;
      }

      if (!address || !address.startsWith('r')) {
        throw new Error('Failed to retrieve wallet address from Crossmark');
      }

      
      await handleSuccessfulConnection(address, 'Crossmark signInAndWait');
      return;

    } catch (error) {
      console.error('💥 Crossmark connection error:', error);
      await handleConnectionError(error);
    } finally {
      onConnectionEnd();
    }
  };

  const handleCrossmarkNotFound = async () => {
    const hasMetaMask = !!(window as any).ethereum?.isMetaMask;
    
    if (hasMetaMask) {
      toast({
        title: "MetaMask Interference Detected",
        description: "Please temporarily disable MetaMask, refresh the page, then try connecting again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Crossmark Not Found",
        description: "Please install the Crossmark browser extension and refresh the page.",
        variant: "destructive",
      });
    }

    const shouldOpenHelp = confirm(
      hasMetaMask 
        ? "MetaMask may be interfering with Crossmark detection. Would you like to visit the troubleshooting page?"
        : "Crossmark extension not found. Would you like to visit the installation page?"
    );
    
    if (shouldOpenHelp) {
      window.open(hasMetaMask 
        ? 'https://crossmark.io/troubleshooting' 
        : 'https://crossmark.io', '_blank');
    }
  };

  const handleConnectionError = async (error: any) => {
    const errorMessage = error instanceof Error ? error.message : "Unknown connection error";
    const hasMetaMask = !!(window as any).ethereum?.isMetaMask;
    
    let title = "Connection Failed";
    let description = errorMessage;
    
    if (errorMessage.includes('not found')) {
      title = "Crossmark Not Found";
      description = hasMetaMask 
        ? "Crossmark not detected. Try disabling MetaMask temporarily."
        : "Crossmark extension not found. Please install it from crossmark.io";
    } else if (errorMessage.includes('denied') || errorMessage.includes('rejected')) {
      title = "Connection Rejected";
      description = "Please approve the connection request in Crossmark.";
    } else if (hasMetaMask) {
      description += "\n\nTip: Try disabling MetaMask temporarily.";
    }
    
    toast({
      title,
      description,
      variant: "destructive",
    });
  };

  const handleSuccessfulConnection = async (address: string, method: string) => {
    try {
      await connectXRPL();
      
      const balances = await getAccountBalances(address);
      const xrpBalance = balances.find(b => b.currency === 'XRP')?.value || '0';

      const walletInfo: XRPLWallet = {
        address: address,
        seed: '', // Crossmark doesn't expose seed
        balance: xrpBalance
      };

      toast({
        title: "🎉 Wallet Connected Successfully",
        description: `Connected to ${address.slice(0, 8)}... via Crossmark`,
      });

      onWalletConnected(walletInfo);

      // Auto-setup RLUSD trust line
      setTimeout(() => {
        setupRLUSDTrustLine(walletInfo, toast);
      }, 2000);
      
    } catch (error) {
      console.error('❌ Post-connection setup failed:', error);
      toast({
        title: "Setup Warning",
        description: "Connected successfully but some features may not work properly.",
        variant: "default",
      });
    }
  };

  // Check if MetaMask is present and show warning
  const isMetaMaskActive = !!(window as any).ethereum?.isMetaMask;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 text-center">
        Connect using Crossmark browser extension
      </p>
      
      {isMetaMaskActive && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-orange-800">
            <strong>MetaMask Detected:</strong> If connection fails, try temporarily disabling MetaMask and refreshing the page.
          </div>
        </div>
      )}
      
      <Button 
        onClick={handleConnectCrossmark}
        disabled={isConnecting}
        className="w-full bg-green-600 hover:bg-green-700"
        size="lg"
      >
        {isConnecting ? 'Connecting...' : 'Connect Crossmark Wallet'}
      </Button>
      
      <p className="text-xs text-gray-500 text-center">
        Don't have Crossmark? <a href="https://crossmark.io" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline inline-flex items-center gap-1">
          Download here <ExternalLink className="w-3 h-3" />
        </a>
      </p>
      
      <div className="text-xs text-center space-y-1">
        <p className="text-orange-600">
          ⚠️ Make sure Crossmark is unlocked and you're signed in before connecting
        </p>
        <p className="text-gray-500">
          💡 Look for popup windows that may require your approval
        </p>
      </div>
    </div>
  );
};