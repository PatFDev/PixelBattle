import React, { useState, useEffect } from 'react';
import { Trophy, Paintbrush, Coins, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from '../lib/utils';

interface UserStats {
  wallet: string;
  pixels_painted: number;
  total_deposited: number;
  last_active: string;
}

export const Leaderboard: React.FC = () => {
  const [stats, setStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .order('pixels_painted', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading leaderboard:', error);
        return;
      }

      if (data) {
        setStats(data);
      }
      setLoading(false);
    };

    loadStats();

    // Subscribe to changes
    const channel = supabase
      .channel('leaderboard_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_stats'
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h2 className="text-2xl font-bold text-gray-900">Leaderboard</h2>
      </div>

      <div className="space-y-4">
        {stats.map((user, index) => (
          <div
            key={user.wallet}
            className={`p-4 rounded-lg ${
              index === 0
                ? 'bg-yellow-50 border border-yellow-200'
                : index === 1
                ? 'bg-gray-50 border border-gray-200'
                : index === 2
                ? 'bg-orange-50 border border-orange-200'
                : 'bg-white border border-gray-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-gray-400 w-8">
                  #{index + 1}
                </span>
                <div>
                  <p className="font-medium text-gray-900">
                    {formatWallet(user.wallet)}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Paintbrush className="w-4 h-4" />
                      {user.pixels_painted} pixels
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="w-4 h-4" />
                      {user.total_deposited.toFixed(4)} SOL
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1" />
                {formatDistanceToNow(new Date(user.last_active))}
              </div>
            </div>
          </div>
        ))}

        {stats.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No pixels painted yet. Be the first!
          </div>
        )}
      </div>
    </div>
  );
}