
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Send } from 'lucide-react';
import { XRPLWallet, sendXRPPayment, sendRLUSDPayment } from '@/utils/xrplClient';
import { Wallet as XRPLWalletClass } from 'xrpl';

interface SendPaymentProps {
  userWallet: XRPLWallet;
  onPaymentSent: () => void;
}

export const SendPayment: React.FC<SendPaymentProps> = ({ userWallet, onPaymentSent }) => {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('XRP');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSendPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination || !amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid destination address and amount.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const wallet = XRPLWalletClass.fromSeed(userWallet.seed);
      let txHash: string;
      
      if (currency === 'XRP') {
        txHash = await sendXRPPayment(wallet, destination, parseFloat(amount));
      } else {
        txHash = await sendRLUSDPayment(wallet, destination, parseFloat(amount));
      }
      
      toast({
        title: "Payment Sent",
        description: `Successfully sent ${amount} ${currency}. TX: ${txHash.slice(0, 8)}...`,
      });

      setDestination('');
      setAmount('');
      onPaymentSent();
    } catch (error) {
      console.error('Payment failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Send Payment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSendPayment} className="space-y-4">
          <div>
            <Label htmlFor="destination">Destination Address</Label>
            <Input
              id="destination"
              placeholder="Enter recipient's XRPL address"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="XRP">XRP</SelectItem>
                <SelectItem value="RLUSD">RLUSD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="amount">Amount ({currency})</Label>
            <Input
              id="amount"
              type="number"
              step="0.000001"
              min="0.000001"
              placeholder={`Enter amount in ${currency}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          
          {currency === 'RLUSD' && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-1">RLUSD Payment</p>
              <p className="text-xs text-blue-600">
                The recipient must have an RLUSD trust line to receive this payment.
              </p>
            </div>
          )}
          
          <Button 
            type="submit" 
            disabled={isSending}
            className="w-full"
          >
            {isSending ? 'Sending...' : `Send ${currency}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
