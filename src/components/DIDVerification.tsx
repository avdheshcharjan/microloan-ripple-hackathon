import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, CheckCircle, User } from 'lucide-react';
import { createXRPLWallet, createDIDTransaction, XRPLWallet } from '@/utils/xrplClient';
import { Wallet } from 'xrpl';

interface DIDVerificationProps {
  isVerified: boolean;
  onVerificationComplete: (walletInfo: XRPLWallet, txHash: string) => void;
}

export const DIDVerification: React.FC<DIDVerificationProps> = ({ isVerified, onVerificationComplete }) => {
  const [verificationData, setVerificationData] = useState({
    fullName: '',
    phone: ''
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    const numbersOnly = value.replace(/[^0-9]/g, '');
    setVerificationData({ ...verificationData, phone: numbersOnly });
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      toast({
        title: "Creating XRPL Wallet",
        description: "Generating your wallet on the XRP Ledger...",
      });

      // Create XRPL wallet
      const walletInfo = await createXRPLWallet();
      
      toast({
        title: "Wallet Created",
        description: `Wallet address: ${walletInfo.address.slice(0, 8)}...`,
      });

      // Create wallet instance from seed
      const wallet = Wallet.fromSeed(walletInfo.seed);

      // Create DID verification transaction
      const txHash = await createDIDTransaction(wallet, verificationData);

      toast({
        title: "DID Verification Complete",
        description: "Your decentralized identity has been verified on the XRP Ledger.",
      });

      onVerificationComplete(walletInfo, txHash);
      setIsVerifying(false);
    } catch (error) {
      console.error('DID verification failed:', error);
      toast({
        title: "Verification Failed",
        description: "There was an error creating your wallet or verifying your identity. Please try again.",
        variant: "destructive",
      });
      setIsVerifying(false);
    }
  };

  if (isVerified) {
    return (
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            DID Verified on XRPL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-green-600" />
            <div>
              <p className="font-medium">Your identity is verified</p>
              <p className="text-sm text-gray-600">Verified on XRP Ledger with decentralized identity</p>
            </div>
            <Badge variant="secondary" className="ml-auto">
              Verified
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          XRPL Decentralized Identity Verification
        </CardTitle>
        <p className="text-sm text-gray-600">
          Complete DID verification with your name and phone number to create an XRPL wallet and access the microloan platform
        </p>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-full mx-auto mb-3 flex items-center justify-center">
              <User className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold">Verify Your Identity</h3>
            <p className="text-gray-600">
              Enter your information to create an XRPL wallet and verify your decentralized identity
            </p>
          </div>

          <form onSubmit={handleVerification} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={verificationData.fullName}
                onChange={(e) => setVerificationData({ ...verificationData, fullName: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter your phone number"
                value={verificationData.phone}
                onChange={handlePhoneChange}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={isVerifying}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isVerifying ? 'Creating Wallet & Verifying...' : 'Create XRPL Wallet & Verify DID'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};
