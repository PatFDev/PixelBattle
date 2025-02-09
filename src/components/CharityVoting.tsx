import React, { useState, useEffect } from 'react';
import { Heart, Users, Leaf, Dog } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { supabase } from '../lib/supabase';

interface Charity {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  votes: number;
  weightedVotes: number;
}

const CHARITIES: Charity[] = [
  {
    id: 'children',
    name: 'Children\'s Education Fund',
    description: 'Supporting education for underprivileged children worldwide',
    icon: <Heart className="w-6 h-6 text-pink-500" />,
    votes: 0,
    weightedVotes: 0
  },
  {
    id: 'homeless',
    name: 'Homeless Support Initiative',
    description: 'Providing shelter and support for homeless individuals',
    icon: <Users className="w-6 h-6 text-blue-500" />,
    votes: 0,
    weightedVotes: 0
  },
  {
    id: 'environment',
    name: 'Environmental Protection',
    description: 'Fighting climate change and protecting ecosystems',
    icon: <Leaf className="w-6 h-6 text-green-500" />,
    votes: 0,
    weightedVotes: 0
  },
  {
    id: 'animals',
    name: 'Animal Welfare',
    description: 'Supporting animal shelters and wildlife conservation',
    icon: <Dog className="w-6 h-6 text-yellow-500" />,
    votes: 0,
    weightedVotes: 0
  }
];

interface Props {
  totalDeposited: number;
  userDeposit: number;
  onVote: (charityId: string | undefined) => void;
  votedCharity?: string;
}

export const CharityVoting: React.FC<Props> = ({ totalDeposited, userDeposit, onVote, votedCharity }) => {
  const [charities, setCharities] = useState<Charity[]>(CHARITIES);
  const [userVote, setUserVote] = useState<string | undefined>(undefined);
  const { publicKey } = useWallet();
  const [isRemoving, setIsRemoving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [voteChannel, setVoteChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);

  // Load initial data and check user's vote
  useEffect(() => {
    const loadData = async () => {
      if (!publicKey) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Load user's existing vote
        const { data: userVoteData } = await supabase
          .from('votes')
          .select('charity_id')
          .eq('wallet', publicKey.toString());

        if (userVoteData && userVoteData.length > 0) {
          const existingVote = userVoteData[0].charity_id;
          setUserVote(existingVote);
          onVote(existingVote);
        }

        // Load charities and vote counts
        const [charitiesResponse, votesResponse] = await Promise.all([
          supabase.from('charities').select('*, total_weighted_votes'),
          supabase.from('votes').select('charity_id, weight')
        ]);

        if (charitiesResponse.error) throw charitiesResponse.error;
        if (votesResponse.error) throw votesResponse.error;

        const voteCounts = (votesResponse.data || []).reduce((acc: Record<string, { count: number; weight: number }>, vote) => {
          if (!acc[vote.charity_id]) {
            acc[vote.charity_id] = { count: 0, weight: 0 };
          }
          acc[vote.charity_id].count += 1;
          acc[vote.charity_id].weight += vote.weight || 1;
          return acc;
        }, {});

        const updatedCharities = (charitiesResponse.data || []).map(charity => ({
          id: charity.id,
          name: charity.name,
          description: charity.description,
          icon: getIconComponent(charity.icon),
          votes: voteCounts[charity.id]?.count ?? 0,
          weightedVotes: charity.total_weighted_votes ?? 0
        }));

        setCharities(updatedCharities);
      } catch (error) {
        console.error('Error loading voting data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Subscribe to vote changes
    const voteChannel = supabase
      .channel('votes_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'votes',
          filter: `charity_id=in.(${CHARITIES.map(c => c.id).join(',')})`
        },
        (payload) => {
          console.log('Vote change detected:', payload);
          loadData(); // Reload all data to get updated totals
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'charities'
        },
        (payload) => {
          console.log('Charity update detected:', payload);
          if (payload.new) {
            setCharities(prev => prev.map(charity => 
              charity.id === payload.new.id
                ? {
                    ...charity,
                    weightedVotes: payload.new.total_weighted_votes || 0
                  }
                : charity
            ));
          }
        }
      )
      .subscribe();

    setVoteChannel(voteChannel);

    return () => {
      if (voteChannel) {
        voteChannel.unsubscribe();
      }
    };
  }, [publicKey, onVote]);

  const getIconComponent = (iconName: string) => {
    const icons = { Heart, Users, Leaf, Dog };
    const IconComponent = icons[iconName];
    return <IconComponent className={`w-6 h-6 text-${getIconColor(iconName)}-500`} />;
  };

  const getIconColor = (iconName: string) => {
    const colors = {
      Heart: 'pink',
      Users: 'blue',
      Leaf: 'green',
      Dog: 'yellow'
    };
    return colors[iconName] || 'gray';
  };

  const handleVote = async (charityId: string) => {
    if (userDeposit > 0 && publicKey) {
      try {
        // Check if user has already voted
        if (userVote) {
          console.log('User has already voted');
          return;
        }

        // Calculate voting power: 1 vote per pixel (0.0001 SOL = 1 pixel)
        const votingWeight = Math.floor(userDeposit / 0.0001);

        // First check if a vote already exists
        const { data: existingVote } = await supabase
          .from('votes')
          .select('*')
          .eq('wallet', publicKey.toString())
          .maybeSingle();

        if (existingVote?.charity_id) {
          console.log('Vote already exists');
          return;
        }

        // Optimistically update UI
        setCharities(prev => prev.map(charity => 
          charity.id === charityId 
            ? { 
                ...charity, 
                votes: charity.votes + 1,
                weightedVotes: charity.weightedVotes + votingWeight
              }
            : charity
        ));

        const { error } = await supabase
          .from('votes')
          .insert({
            charity_id: charityId,
            wallet: publicKey.toString(),
            weight: votingWeight
          });

        if (error) {
          console.error('Error recording vote:', error);
          // Revert optimistic update
          setCharities(prev => prev.map(charity => 
            charity.id === charityId 
              ? { 
                  ...charity, 
                  votes: charity.votes - 1,
                  weightedVotes: charity.weightedVotes - votingWeight
                }
              : charity
          ));
          return;
        } else {
          // Only update state if the vote was successful
          setUserVote(charityId);
          onVote(charityId);
        }
      } catch (error) {
        console.error('Error in handleVote:', error);
        // Revert optimistic update on error
        setCharities(prev => prev.map(charity => 
          charity.id === charityId 
            ? { 
                ...charity, 
                votes: charity.votes - 1,
                weightedVotes: charity.weightedVotes - votingWeight
              }
            : charity
        ));
      }
    }
  };

  const handleRemoveVote = async (charityId: string) => {
    if (!publicKey) return;
    
    try {
      setIsRemoving(true);
      
      // Get the current vote weight before deleting
      const { data: voteData } = await supabase
        .from('votes')
        .select('weight')
        .eq('wallet', publicKey.toString());

      const currentWeight = voteData?.[0]?.weight || 0;

      // Optimistically update UI
      setCharities(prev => prev.map(charity => 
        charity.id === charityId 
          ? { 
              ...charity, 
              votes: charity.votes - 1,
              weightedVotes: charity.weightedVotes - currentWeight
            }
          : charity
      ));

      const { error } = await supabase
        .from('votes')
        .delete()
        .eq('wallet', publicKey.toString());

      if (error) {
        console.error('Error removing vote:', error);
        // Revert optimistic update on error
        setCharities(prev => prev.map(charity => 
          charity.id === charityId 
            ? { 
                ...charity, 
                votes: charity.votes + 1,
                weightedVotes: charity.weightedVotes + currentWeight
              }
            : charity
        ));
        return;
      }

      setUserVote(undefined);
      onVote(undefined);
    } catch (error) {
      console.error('Error in handleRemoveVote:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  const totalWeightedVotes = charities.reduce((sum, charity) => sum + charity.weightedVotes, 0);

  return (
    <div className="mt-8 border-t pt-8">
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <div>
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Charity Voting</h3>
            <p className="text-gray-600">
              Total funds raised: {totalDeposited.toFixed(4)} SOL
            </p>
            {userDeposit > 0 && (
              <p className="text-sm text-purple-600 mt-1">
                You've contributed {userDeposit.toFixed(4)} SOL
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {charities.map((charity) => {
              const votePercentage = totalWeightedVotes > 0 
                ? (charity.weightedVotes / totalWeightedVotes) * 100 
                : 0;
                
              return (
                <div 
                  key={charity.id}
                  className={`p-4 rounded-lg border ${
                    votedCharity === charity.id 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 hover:border-purple-300'
                  } transition-colors`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {charity.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{charity.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{charity.description}</p>
                      <div className="mt-3">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 transition-all duration-500"
                            style={{ width: `${votePercentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-500">
                            <span className="text-purple-600 font-medium">
                              {Math.floor(charity.weightedVotes)} voting power
                            </span>
                            <span className="mx-2">·</span>
                            <span>
                              {votePercentage.toFixed(1)}% share
                            </span>
                          </span>
                          {userVote === charity.id ? (
                            <button
                              onClick={() => handleRemoveVote(charity.id)}
                              disabled={isRemoving}
                              className="px-3 py-1 text-sm rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                            >
                              {isRemoving ? 'Removing...' : 'Remove Vote'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVote(charity.id)}
                              disabled={!userDeposit || userVote !== undefined || !publicKey}
                              className={`px-3 py-1 text-sm rounded-md ${
                                userDeposit && !userVote && publicKey
                                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {!publicKey ? 'Connect Wallet' :
                               !userDeposit ? 'Deposit First' : 'Vote'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};