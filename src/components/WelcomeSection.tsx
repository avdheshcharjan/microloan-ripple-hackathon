
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletCreation } from '@/components/WalletCreation';
import { WalletConnection } from '@/components/WalletConnection';
import { XRPLWallet } from '@/utils/xrplClient';

interface WelcomeSectionProps {
  hasWallet: boolean;
  onWalletCreated: (walletInfo: XRPLWallet) => void;
  onWalletConnected: (walletInfo: XRPLWallet) => void;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({ hasWallet, onWalletCreated, onWalletConnected }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-6">
          Decentralized Microloans
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Create loan NFTs on the XRP Ledger. Fund microloans with RLUSD for stable returns while supporting financial inclusion worldwide.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-800">Create Loan NFTs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-blue-700">Tokenize microloans as NFTs on the XRP Ledger for transparent, tradeable debt instruments.</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-800">Fund with RLUSD</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-700">Use Ripple's stablecoin for stable, predictable returns while supporting entrepreneurs globally.</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-800">DID Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-purple-700">Secure identity verification using decentralized identifiers on the XRP Ledger.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <WalletConnection
          hasWallet={hasWallet}
          onWalletConnected={onWalletConnected}
        />
        
        <WalletCreation
          hasWallet={hasWallet}
          onWalletCreated={onWalletCreated}
        />
      </div>
    </div>
  );
};
