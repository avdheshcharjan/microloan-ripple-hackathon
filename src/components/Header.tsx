
import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield, Zap, Wallet, Copy, LogOut, ExternalLink } from 'lucide-react';

interface HeaderProps {
  hasWallet: boolean;
  didTransactionHash: string;
  walletAddress: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ hasWallet, didTransactionHash, walletAddress, onLogout }) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully.",
      });
    }
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">MicroLend</h1>
              <p className="text-sm text-gray-600">Powered by XRP Ledger</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Get RLUSD Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://tryrlusd.com/', '_blank')}
              className="flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Get RLUSD
            </Button>

            {hasWallet && (
              <>
                {/* DID Status */}
                {didTransactionHash && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-green-700">
                      <Shield className="w-4 h-4" />
                      <span className="text-sm font-medium">DID Created</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                      <span className="text-xs text-gray-600">TX:</span>
                      <span className="text-xs font-mono text-gray-800">
                        {didTransactionHash.slice(0, 8)}...{didTransactionHash.slice(-8)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(didTransactionHash, 'Transaction hash')}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Wallet Address */}
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                  <Wallet className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-mono text-blue-800">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(walletAddress, 'Wallet address')}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>

                {/* Logout Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
