
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, Copy, QrCode } from 'lucide-react';
import { XRPLWallet } from '@/utils/xrplClient';

interface ReceivePaymentProps {
  userWallet: XRPLWallet;
}

export const ReceivePayment: React.FC<ReceivePaymentProps> = ({ userWallet }) => {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Receive XRP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600 mb-4">Share your address to receive payments</p>
            <div className="bg-white p-3 rounded border break-all">
              <p className="text-sm font-mono">{userWallet.address}</p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => copyToClipboard(userWallet.address, 'Wallet address')}
          className="w-full"
          variant="outline"
        >
          <Copy className="w-4 h-4 mr-2" />
          Copy Address
        </Button>
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Only send XRP and XRPL-compatible tokens to this address
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
