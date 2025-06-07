
import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, KeyRound } from 'lucide-react';

interface WalletConnectionMethodsProps {
  connectionMethod: 'browser' | 'seed';
  onMethodChange: (method: 'browser' | 'seed') => void;
}

export const WalletConnectionMethods: React.FC<WalletConnectionMethodsProps> = ({
  connectionMethod,
  onMethodChange
}) => {
  return (
    <div className="flex space-x-2 mb-4">
      <Button 
        variant={connectionMethod === 'browser' ? 'default' : 'outline'}
        onClick={() => onMethodChange('browser')}
        className="flex-1"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Browser Wallet
      </Button>
      <Button 
        variant={connectionMethod === 'seed' ? 'default' : 'outline'}
        onClick={() => onMethodChange('seed')}
        className="flex-1"
      >
        <KeyRound className="w-4 h-4 mr-2" />
        Seed Phrase
      </Button>
    </div>
  );
};
