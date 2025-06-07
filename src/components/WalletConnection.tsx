
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Wallet } from 'lucide-react';
import { XRPLWallet } from '@/utils/xrplClient';
import { CrossmarkConnection } from '@/components/CrossmarkConnection';
import { SeedConnection } from '@/components/SeedConnection';
import { WalletConnectionMethods } from '@/components/WalletConnectionMethods';

interface WalletConnectionProps {
  hasWallet: boolean;
  onWalletConnected: (walletInfo: XRPLWallet) => void;
}

export const WalletConnection: React.FC<WalletConnectionProps> = ({ hasWallet, onWalletConnected }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<'browser' | 'seed'>('browser');

  const handleConnectionStart = () => setIsConnecting(true);
  const handleConnectionEnd = () => setIsConnecting(false);

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" />
          Connect Existing Wallet
        </CardTitle>
        <p className="text-sm text-gray-600">
          Connect your existing XRPL wallet using Crossmark or wallet seed
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-600 text-white rounded-full mx-auto mb-3 flex items-center justify-center">
              <Wallet className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold">Connect Wallet</h3>
            <p className="text-gray-600">
              Choose your preferred connection method
            </p>
          </div>

          <WalletConnectionMethods
            connectionMethod={connectionMethod}
            onMethodChange={setConnectionMethod}
          />

          {connectionMethod === 'browser' ? (
            <CrossmarkConnection
              isConnecting={isConnecting}
              onConnectionStart={handleConnectionStart}
              onConnectionEnd={handleConnectionEnd}
              onWalletConnected={onWalletConnected}
            />
          ) : (
            <SeedConnection
              isConnecting={isConnecting}
              onConnectionStart={handleConnectionStart}
              onConnectionEnd={handleConnectionEnd}
              onWalletConnected={onWalletConnected}
            />
          )}
          
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 font-medium mb-1">Auto RLUSD Setup</p>
            <p className="text-xs text-blue-600">
              For seed-based connections, RLUSD trust line will be created automatically after connection.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
