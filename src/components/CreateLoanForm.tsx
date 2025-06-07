
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Shield } from 'lucide-react';
import { createMicroloanNFT, XRPLWallet } from '@/utils/xrplClient';
import { Wallet } from 'xrpl';

interface CreateLoanFormProps {
  onCreateLoan: (loan: any) => void;
  userDidVerified: boolean;
  userWallet?: XRPLWallet;
}

export const CreateLoanForm: React.FC<CreateLoanFormProps> = ({ onCreateLoan, userDidVerified, userWallet }) => {
  const [formData, setFormData] = useState({
    amount: '',
    purpose: '',
    interestRate: '',
    duration: '',
    category: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userWallet) {
      toast({
        title: "Wallet Required",
        description: "Please create or connect a wallet before creating a loan request.",
        variant: "destructive",
      });
      return;
    }

    if (!userDidVerified) {
      toast({
        title: "DID Verification Required",
        description: "You must complete DID verification before creating a loan request. Please go to the Dashboard to create your DID.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.amount || !formData.purpose || !formData.interestRate || !formData.duration) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate loan amount
    const amount = parseFloat(formData.amount);
    if (amount < 1 || amount > 50000) {
      toast({
        title: "Invalid Amount",
        description: "Loan amount must be between $1 and $50,000 RLUSD.",
        variant: "destructive",
      });
      return;
    }

    // Validate interest rate
    const interestRate = parseFloat(formData.interestRate);
    if (interestRate < 0.1 || interestRate > 50) {
      toast({
        title: "Invalid Interest Rate",
        description: "Interest rate must be between 0.1% and 50%.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      toast({
        title: "Creating Loan NFT",
        description: "Minting your loan request as an NFT on XRPL...",
      });

      // Create wallet instance from seed
      const wallet = Wallet.fromSeed(userWallet.seed);

      // Create microloan NFT on XRPL
      const nftData = await createMicroloanNFT(wallet, {
        amount: parseFloat(formData.amount),
        purpose: formData.purpose,
        interestRate: parseFloat(formData.interestRate),
        duration: formData.duration
      });

      const newLoan = {
        id: nftData.nftId,
        borrower: 'You',
        amount: parseFloat(formData.amount),
        purpose: formData.purpose,
        interestRate: parseFloat(formData.interestRate),
        duration: formData.duration,
        fundedAmount: 0,
        status: 'active' as const,
        didVerified: userDidVerified,
        riskScore: 'medium' as const,
        createdAt: new Date().toISOString(),
        category: formData.category,
        nftId: nftData.nftId,
        txHash: nftData.txHash
      };

      onCreateLoan(newLoan);
      
      toast({
        title: "Loan NFT Created",
        description: "Your loan request has been minted as an NFT on XRPL.",
      });

      // Reset form
      setFormData({
        amount: '',
        purpose: '',
        interestRate: '',
        duration: '',
        category: ''
      });
      
      setIsSubmitting(false);
    } catch (error) {
      console.error('Failed to create loan NFT:', error);
      toast({
        title: "Creation Failed",
        description: "There was an error creating your loan NFT. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Create Loan Request as NFT
        </CardTitle>
        <p className="text-sm text-gray-600">
          Your loan request will be minted as an NFT on the XRP Ledger
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Loan Amount (RLUSD)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="1000"
                min="1"
                max="50000"
                step="1"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500">Minimum: $1 RLUSD, Maximum: $50,000 RLUSD</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="interestRate">Interest Rate (%)</Label>
              <Input
                id="interestRate"
                type="number"
                step="0.1"
                min="0.1"
                max="50"
                placeholder="5.5"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500">Annual interest rate between 0.1% and 50%</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Loan Duration</Label>
              <Select onValueChange={(value) => setFormData({ ...formData, duration: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3 months">3 months</SelectItem>
                  <SelectItem value="6 months">6 months</SelectItem>
                  <SelectItem value="12 months">12 months</SelectItem>
                  <SelectItem value="24 months">24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Loan Category</Label>
              <Select onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="agriculture">Agriculture</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="housing">Housing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="purpose">Loan Purpose</Label>
            <Textarea
              id="purpose"
              placeholder="Describe how you plan to use this loan and your repayment strategy..."
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              required
              rows={4}
            />
          </div>
          
          {!userDidVerified && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-800">DID Verification Required</span>
              </div>
              <p className="text-sm text-red-700">
                You must complete DID verification before creating loan NFTs. This helps build trust with potential lenders.
              </p>
              <p className="text-xs text-red-600 mt-1">
                Go to Dashboard → Decentralized Identity (DID) section to get verified.
              </p>
            </div>
          )}
          
          {userDidVerified && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-600" />
              <span className="text-green-800">✓ DID Verified - Ready to create loan NFTs</span>
            </div>
          )}
          
          <Button 
            type="submit" 
            disabled={isSubmitting || !userWallet || !userDidVerified}
            className={`w-full ${
              userDidVerified 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting 
              ? 'Minting Loan NFT...' 
              : !userDidVerified 
                ? 'DID Verification Required' 
                : 'Create Loan NFT on XRPL'
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
