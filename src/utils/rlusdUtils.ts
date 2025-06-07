
import { XRPLWallet, createRLUSDTrustLine } from '@/utils/xrplClient';
import { Wallet as XRPLWalletClass } from 'xrpl';

export const setupRLUSDTrustLine = async (walletInfo: XRPLWallet, toast: any) => {
  if (!walletInfo.seed) {
    // Can't create trust line without seed (Crossmark case)
    toast({
      title: "Trust Line Setup",
      description: "Please manually create RLUSD trust line through Crossmark to receive RLUSD payments.",
      variant: "default",
    });
    return;
  }

  try {
    toast({
      title: "Setting up RLUSD",
      description: "Creating RLUSD trust line automatically...",
    });

    const wallet = XRPLWalletClass.fromSeed(walletInfo.seed);
    await createRLUSDTrustLine(wallet);
    
    toast({
      title: "RLUSD Ready",
      description: "Your wallet can now send and receive RLUSD payments!",
    });
  } catch (error) {
    console.error('Auto trust line setup failed:', error);
    toast({
      title: "Trust Line Setup",
      description: "Please create RLUSD trust line manually in the dashboard.",
      variant: "default",
    });
  }
};
