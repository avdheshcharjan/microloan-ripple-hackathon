
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Copy, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WalletSuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  balance: string;
}

export const WalletSuccessPopup: React.FC<WalletSuccessPopupProps> = ({
  isOpen,
  onClose,
  walletAddress,
  balance
}) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-6 h-6" />
            Wallet Created Successfully!
          </DialogTitle>
          <DialogDescription>
            Your XRPL wallet has been created and funded with test XRP. You can now access the microloan platform.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Wallet Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Wallet Address</label>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Wallet className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-mono text-blue-800 flex-1 break-all">
                {walletAddress}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => copyToClipboard(walletAddress, 'Wallet address')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Balance */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Balance</label>
            <div className="p-3 bg-green-50 rounded-lg">
              <span className="text-lg font-semibold text-green-800">
                {balance} XRP
              </span>
              <p className="text-xs text-green-600 mt-1">Test network funds</p>
            </div>
          </div>

          {/* Continue Button */}
          <Button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700">
            Continue to Dashboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
