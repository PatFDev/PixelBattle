import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection
} from '@solana/web3.js';
import { CharityVoting } from './CharityVoting';
import { supabase } from '../lib/supabase';

interface PixelData {
  x: number;
  y: number;
  color: string;
  owner: string;
}

interface Pixel {
  color: string;
  owner: string;
  timestamp: number;
}

const GRID_SIZE_HEIGHT = 32;
const GRID_SIZE_WIDTH = 64;
const PIXEL_COST = 0.0001;
const RECIPIENT_WALLET = new PublicKey("2UoYdRRmB2PzFDJE2EbEJH477DBVCQMArXS9N4n699jc");

const COLOR_PALETTE = [
  // Grayscale
  { category: 'Grayscale', colors: [
    '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF'
  ]},
  // Primary Colors
  { category: 'Primary', colors: [
    '#FF0000', '#00FF00', '#0000FF', 
    '#FF4444', '#44FF44', '#4444FF'
  ]},
  // Secondary Colors
  { category: 'Secondary', colors: [
    '#FFFF00', '#FF00FF', '#00FFFF',
    '#FFFF44', '#FF44FF', '#44FFFF'
  ]},
  // Warm Colors
  { category: 'Warm', colors: [
    '#FF8800', '#FF4400', '#FF0088',
    '#FF9933', '#FF6600', '#CC3300'
  ]},
  // Cool Colors
  { category: 'Cool', colors: [
    '#00FF88', '#0088FF', '#8800FF',
    '#33FF99', '#3399FF', '#9933FF'
  ]},
  // Earth Tones
  { category: 'Earth', colors: [
    '#8B4513', '#A0522D', '#CD853F',
    '#DEB887', '#D2B48C', '#F4A460'
  ]},
  // Pastel Colors
  { category: 'Pastel', colors: [
    '#FFB6C1', '#98FB98', '#87CEFA',
    '#DDA0DD', '#F0E68C', '#E6E6FA'
  ]}
];

export const PixelGrid: React.FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [pixels, setPixels] = useState<Pixel[][]>(
    Array(GRID_SIZE_HEIGHT).fill(null).map(() =>
      Array(GRID_SIZE_WIDTH).fill({ color: '#FFFFFF', owner: '', timestamp: 0 })
    )
  );
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0].colors[0]);
  const [selectedCategory, setSelectedCategory] = useState(COLOR_PALETTE[0].category);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showDevnetInfo, setShowDevnetInfo] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [depositedPixels, setDepositedPixels] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState('10');
  const [totalDeposited, setTotalDeposited] = useState(0);
  const [userDeposit, setUserDeposit] = useState(0);
  const [votedCharity, setVotedCharity] = useState<string>();
  const [brushSize, setBrushSize] = useState(1);

  // Optimistically update the grid
  const updateGridPixel = (x: number, y: number, color: string, owner: string) => {
    setPixels(prevPixels => {
      const newGrid = prevPixels.map(row => [...row]);
      newGrid[y][x] = {
        color,
        owner,
        timestamp: Date.now()
      };
      return newGrid;
    });
  };

  // Initialize grid and set up real-time subscription
  useEffect(() => {
    const loadPixels = async () => {
      console.log('🔄 Loading initial pixels from database...');
      const { data, error } = await supabase
        .from('pixels')
        .select('x, y, color, owner');

      if (error) {
        console.error('❌ Error loading initial pixels:', error);
        return;
      }

      if (data) {
        console.log('✅ Initial pixels loaded:', data.length, 'pixels found');
        const newGrid = [...pixels];
        data.forEach(pixel => {
          newGrid[pixel.y][pixel.x] = {
            color: pixel.color,
            owner: pixel.owner,
            timestamp: 0
          };
        });
        setPixels(newGrid);
      }
    };
    
    loadPixels();
    
    console.log('🔌 Setting up real-time subscription to pixel changes...');

    // Set up real-time subscription
    const pixelChannel = supabase
      .channel('pixels')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pixels'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const pixelData = payload.new as PixelData;
            console.log(`📥 Received ${payload.eventType} pixel update:`, pixelData);
            updateGridPixel(pixelData.x, pixelData.y, pixelData.color, pixelData.owner);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Subscription status:', status);
      });

    // Monitor channel status
    pixelChannel
      .on('system', { event: '*' }, (payload) => {
        console.log('📡 Realtime system event:', payload);
      })
      .on('subscription', { event: '*' }, (payload) => {
        console.log('🎯 Subscription event:', payload);
      })
      .on('presence', { event: '*' }, (payload) => {
        console.log('👥 Presence event:', payload);
      });

    console.log('✅ Real-time subscription setup complete');

    return () => {
      console.log('🔌 Cleaning up real-time subscription...');
      pixelChannel.unsubscribe();
    };
  }, []);

  // Load user's deposit total
  useEffect(() => {
    const loadUserDeposits = async () => {
      if (!publicKey) return;
      
      const { data } = await supabase
        .from('user_stats')
        .select('total_deposited, available_pixels')
        .eq('wallet', publicKey.toString());

      if (data && data[0]) {
        setUserDeposit(Number(data[0].total_deposited));
        setDepositedPixels(data[0].available_pixels);
      }
    };

    loadUserDeposits();

    // Subscribe to user_stats changes
    const channel = supabase
      .channel('user_stats_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_stats',
          filter: `wallet=eq.${publicKey?.toString()}`
        },
        (payload) => {
          if (payload.new) {
            setDepositedPixels(payload.new.available_pixels);
            setUserDeposit(Number(payload.new.total_deposited));
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [publicKey]);

  // Load total deposits
  useEffect(() => {
    const loadTotalDeposits = async () => {
      const { data } = await supabase
        .from('deposits')
        .select('amount');

      if (data) {
        const total = data.reduce((sum, deposit) => sum + Number(deposit.amount), 0);
        setTotalDeposited(total);
      }
    };

    loadTotalDeposits();
  }, []);

  useEffect(() => {
    const updateBalance = async () => {
      if (publicKey && connection) {
        try {
          const bal = await connection.getBalance(publicKey);
          setBalance(bal / LAMPORTS_PER_SOL);
        } catch (error) {
          console.error('Error fetching balance:', error);
        }
      } else {
        setBalance(null);
      }
    };

    updateBalance();
    // Set up balance polling
    const interval = setInterval(updateBalance, 5000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  const handleDeposit = async () => {
    if (!publicKey || !connection) {
      setMessage('Please connect your wallet first!');
      console.error('Deposit attempted without wallet connection');
      return;
    }

    try {
      setLoading(true);
      setMessage('Processing deposit...');

      const pixelCount = parseInt(depositAmount);

      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const requiredLamports = LAMPORTS_PER_SOL * PIXEL_COST * pixelCount;

      const transaction = new Transaction();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: RECIPIENT_WALLET,
        lamports: requiredLamports,
      });

      transaction.add(transferInstruction);

      try {
        const signature = await sendTransaction(transaction, connection);
        
        // Wait for transaction confirmation
        await connection.confirmTransaction(signature, 'confirmed');

        const depositValue = PIXEL_COST * pixelCount;

        // Record deposit in Supabase
        const { error: depositError } = await supabase
          .from('deposits')
          .insert({
            wallet: publicKey.toString(),
            amount: depositValue
          });

        if (depositError) {
          console.error('Error recording deposit:', depositError);
          throw depositError;
        }

        // Immediately update local state
        setDepositedPixels(prev => prev + pixelCount);
        setUserDeposit(prev => prev + depositValue);
        setTotalDeposited(prev => prev + depositValue);

        setMessage(`Successfully deposited! You now have ${depositedPixels + pixelCount} pixels available to paint.`);

      } catch (error) {
        console.error('Error during transaction:', error);
        setMessage('Error: Failed to complete transaction. Please try again.');
        throw error;
      }
      
    } catch (error) {
      console.error('Deposit process failed:', error);
      setMessage('Error: Failed to process deposit. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const checkBalance = async (requiredAmount: number) => {
    if (!publicKey) return false;
    try {
      const balance = await connection.getBalance(publicKey);
      return balance >= requiredAmount;
    } catch (error) {
      console.error('Balance check error:', error);
      return false;
    }
  };

  const claimPixel = async (x: number, y: number) => {
    if (!publicKey || !connection) {
      setMessage('Please connect your wallet first!');
      return;
    }
    
    if (depositedPixels <= 0) {
      setMessage('Please deposit SOL for pixels first!');
      return;
    }

    setLoading(true);
    try {
      // Prepare the pixel data
      const pixelData = {
        x,
        y,
        color: selectedColor,
        owner: publicKey?.toString() || 'anonymous'
      };

      // Optimistically update the UI
      updateGridPixel(x, y, selectedColor, pixelData.owner);

      // Use upsert to handle both insert and update cases
      const { error } = await supabase
        .from('pixels')
        .upsert(pixelData, {
          onConflict: 'x,y'
        });

      if (error) {
        console.error('❌ Error updating pixel:', error);
        if (error.code === '42501') {
          setMessage('Please try again');
        } else {
          setMessage(`Error: ${error.message}`);
        }
        return;
      }

      // Update local state immediately
      setDepositedPixels(prev => prev - 1);

      const remainingPixels = depositedPixels - 1;
      setMessage(`Pixel painted! ${remainingPixels} pixel${remainingPixels !== 1 ? 's' : ''} remaining`);
      
    } catch (error) {
      console.error('Error in claimPixel:', error);
      setMessage('Error: Failed to update pixel. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const paintWithBrush = async (centerX: number, centerY: number) => {
    if (!publicKey || depositedPixels <= 0) return;

    const radius = Math.floor(brushSize / 2);

    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const targetX = centerX + x;
        const targetY = centerY + y;

        // Check boundaries
        if (
          targetX >= 0 && targetX < GRID_SIZE_WIDTH &&
          targetY >= 0 && targetY < GRID_SIZE_HEIGHT
        ) {
          if (depositedPixels > 0) {
            await claimPixel(targetX, targetY);
          }
        }
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      {showDevnetInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 relative space-y-4">
          <button
            aria-label="Close devnet info"
            onClick={() => setShowDevnetInfo(false)}
            className="absolute top-2 right-2 text-blue-500 hover:text-blue-700"
          >
            ×
          </button>
          <h3 className="text-blue-800 font-semibold mb-2">Using Solana Devnet</h3>
          <div className="text-blue-600 text-sm space-y-2">
            <p>
              This app runs on Solana's devnet. Get free devnet SOL from{' '}
              <a
                href="https://solfaucet.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline hover:text-blue-800"
              >
                solfaucet.com
              </a>
            </p>
            {publicKey && balance !== null && (
              <p className="font-medium">
                Your balance: {balance.toFixed(4)} SOL
                {balance < PIXEL_COST && (
                  <span className="text-red-600 ml-2">
                    (Insufficient for pixel purchase: {PIXEL_COST} SOL required)
                  </span>
                )}
              </p>
            )}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Pixels"
                />
                <button
                  onClick={handleDeposit}
                  disabled={loading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                >
                  Deposit
                </button>
              </div>
              <div className="text-sm">
                Cost: {(parseFloat(depositAmount || '0') * PIXEL_COST).toFixed(4)} SOL
              </div>
            </div>
            {depositedPixels > 0 && (
              <div className="mt-2 text-sm font-medium text-green-600">
                🎨 You have {depositedPixels} pixels available to paint
              </div>
            )}
          </div>
        </div>
      )}

      <div className="w-full max-w-3xl mb-4">
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          {COLOR_PALETTE.map((palette) => (
            <button
              key={palette.category}
              onClick={() => setSelectedCategory(palette.category)}
              className={`px-3 py-1 rounded-md text-sm whitespace-nowrap ${
                selectedCategory === palette.category
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {palette.category}
            </button>
          ))}
        </div>
        
        {COLOR_PALETTE.map((palette) => (
          <div
            key={palette.category}
            className={`grid grid-cols-6 sm:grid-cols-12 gap-2 ${
              selectedCategory === palette.category ? 'block' : 'hidden'
            }`}
          >
            {palette.colors.map((color) => (
              <button
                key={color}
                className={`aspect-square rounded-lg border-2 transition-transform hover:scale-110 ${
                  selectedColor === color ? 'border-purple-500 shadow-lg' : 'border-gray-200'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
                title={color}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm text-gray-600">Brush Size:</label>
        <input
          type="range"
          min="1"
          max="5"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-32"
        />
        <span className="text-sm text-gray-600">{brushSize}x{brushSize}</span>
      </div>

      <div className="relative">
        <div 
          className="grid gap-[1px] bg-gray-200 p-1 rounded-lg shadow-lg relative"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE_WIDTH}, minmax(8px, 1fr))`,
          }}
        >
          {pixels.map((row, y) =>
            row.map((pixel, x) => (
              <button
                key={`${x}-${y}`}
                className={`aspect-square transition-colors duration-200 hover:opacity-80 ${
                  loading ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{ backgroundColor: pixel.color }}
                onClick={() => !loading && paintWithBrush(x, y)}
                disabled={loading}
              />
            ))
          )}
        </div>
        <div className="mt-4 text-sm text-gray-600 text-center">
          Use the brush size slider to adjust your painting area. Click to paint!
        </div>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded-lg ${
          message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        } text-sm font-medium relative`}>
          {message}
          {message.startsWith('Error') && (
            <button
              onClick={() => setMessage('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs"
              aria-label="Dismiss message"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
      
      <CharityVoting
        totalDeposited={totalDeposited}
        userDeposit={userDeposit}
        onVote={setVotedCharity}
        votedCharity={votedCharity}
      />
      {publicKey && balance !== null && balance < PIXEL_COST && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          ⚠️ Your balance is too low to purchase pixels. Visit{' '}
          <a
            href="https://solfaucet.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-900 underline hover:text-yellow-700"
          >
            solfaucet.com
          </a>
          {' '}to get free devnet SOL.
        </div>
      )}
    </div>
  );
};