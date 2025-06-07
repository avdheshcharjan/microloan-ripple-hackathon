
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, ExternalLink, Copy, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DIDSuccessPopupProps {
  isOpen: boolean;
  onClose: () => void;
  transactionHash: string;
  walletAddress: string;
}

export const DIDSuccessPopup: React.FC<DIDSuccessPopupProps> = ({
  isOpen,
  onClose,
  transactionHash,
  walletAddress
}) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const explorerUrl = `https://testnet.xrpl.org/transactions/${transactionHash}`;

  const shareExplorerUrl = () => {
    navigator.clipboard.writeText(explorerUrl);
    toast({
      title: "Link Copied!",
      description: "XRPL Explorer link copied to clipboard for sharing",
    });
  };

  const handleClose = () => {
    console.log('DID Success Popup - handleClose called');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-6 h-6" />
            DID Verification Successful!
          </DialogTitle>
          <DialogDescription>
            Your decentralized identity has been verified on the XRP Ledger. You can now access the microloan platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Wallet Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Wallet Address</label>
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
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

          {/* Transaction Hash */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Transaction Hash</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-mono text-gray-800 flex-1 break-all">
                {transactionHash}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => copyToClipboard(transactionHash, 'Transaction hash')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Explorer Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.open(explorerUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on XRPL Explorer
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="px-3"
              onClick={shareExplorerUrl}
              title="Copy explorer link for sharing"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Continue Button */}
          <Button onClick={handleClose} className="w-full bg-blue-600 hover:bg-blue-700">
            Continue to Dashboard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
