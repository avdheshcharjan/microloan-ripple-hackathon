import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables:', {
    url: supabaseUrl ? 'set' : 'missing',
    key: supabaseKey ? 'set' : 'missing'
  });
  throw new Error('Missing required Supabase environment variables. Please check your .env file.');
}

let supabaseClient;
try {
  console.log('Initializing Supabase client...');
  supabaseClient = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  throw new Error('Failed to initialize Supabase client. Please check your configuration.');
}

// Export the initialized client
export const supabase = supabaseClient;

// Types
export interface DBLoan {
  /**
   * UUID format required by Supabase
   * This is different from the NFT ID and is used as the primary key
   */
  id: string;
  
  /**
   * The NFT ID from XRPL (transaction hash)
   */
  nft_id: string;
  
  borrower_address: string;
  amount: number;
  purpose: string;
  interest_rate: number;
  duration: string;
  funded_amount: number;
  status: 'active' | 'funded' | 'completed';
  did_verified: boolean;
  risk_score: 'low' | 'medium' | 'high';
  created_at: string;
  tx_hash: string;
}

export interface LoanFilters {
  status?: 'active' | 'funded' | 'completed';
  riskScore?: 'low' | 'medium' | 'high';
  minAmount?: number;
  maxAmount?: number;
  orderBy?: {
    column: 'created_at' | 'amount' | 'interest_rate' | 'funded_amount';
    ascending: boolean;
  };
}

// Create a new loan
export const createLoanInDB = async (loan: DBLoan): Promise<void> => {
  try {
    console.log('Attempting to create loan:', loan);
    const { error } = await supabaseClient
      .from('loans')
      .insert(loan);

    if (error) {
      console.error('Supabase error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
  } catch (error) {
    console.error('Failed to create loan in Supabase:', error);
    throw error;
  }
};

// Fetch user's loans
export const fetchUserLoans = async (userAddress: string): Promise<DBLoan[]> => {
  const { data, error } = await supabaseClient
    .from('loans')
    .select('*')
    .eq('borrower_address', userAddress)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

// Fetch all loans with filtering options
export const fetchAllLoans = async (filters: LoanFilters): Promise<DBLoan[]> => {
  let query = supabaseClient
    .from('loans')
    .select('*');

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.riskScore) {
    query = query.eq('risk_score', filters.riskScore);
  }
  if (filters.minAmount) {
    query = query.gte('amount', filters.minAmount);
  }
  if (filters.maxAmount) {
    query = query.lte('amount', filters.maxAmount);
  }

  // Apply sorting
  if (filters.orderBy) {
    query = query.order(filters.orderBy.column, {
      ascending: filters.orderBy.ascending
    });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
};

// Update loan funding status
export const updateLoanFunding = async (loanId: string, newFundedAmount: number, txHash?: string): Promise<void> => {
  const updateData: Partial<DBLoan> = {
    funded_amount: newFundedAmount,
    status: 'funded'
  };

  if (txHash) {
    updateData.tx_hash = txHash;
  }

  const { error } = await supabaseClient
    .from('loans')
    .update(updateData)
    .eq('id', loanId);

  if (error) throw error;
}; 