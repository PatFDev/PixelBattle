import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Palette } from 'lucide-react';
import { SolanaWalletProvider } from './components/WalletProvider';
import { PixelGrid } from './components/PixelGrid';
import { Leaderboard } from './components/Leaderboard';

function App() {
  return (
    <SolanaWalletProvider>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <Palette className="w-8 h-8 text-purple-600" />
                <h1 className="text-2xl font-bold text-gray-900">Pixel Battle</h1>
              </div>
              <WalletMultiButton />
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Pixel Battle!!!!!</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Claim your piece of digital history! Each pixel costs 0.0001 SOL.
                Connect your Phantom wallet, choose a color, and start painting on
                the blockchain.
              </p>
            </div>
            <PixelGrid />
            <Leaderboard />
          </div>
        </main>
      </div>
    </SolanaWalletProvider>
  );
}

export default App;
