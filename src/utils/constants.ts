
export const XRPL_EXPLORER_URL = import.meta.env.VITE_NETWORK === 'mainnet' 
  ? 'https://xrpl.org/transactions/'
  : 'https://testnet.xrpl.org/transactions/'; 
