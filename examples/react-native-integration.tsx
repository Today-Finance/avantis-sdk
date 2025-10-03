/**
 * React Native/Expo Integration Example
 * Shows how to integrate Avantis SDK in a mobile trading app
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { TraderClient, FeedClient, PositionSide, formatUSDC, formatPrice, formatPnL } from '@todayapp/avantis-sdk';
import Decimal from 'decimal.js';

// Types
interface TradingScreenProps {
  privateKey?: string;
}

interface Position {
  id: string;
  pair: string;
  side: PositionSide;
  size: Decimal;
  entryPrice: Decimal;
  markPrice?: Decimal;
  unrealizedPnl?: Decimal;
  leverage: number;
}

interface MarketData {
  pair: string;
  price: Decimal;
  change24h: number;
}

/**
 * Main Trading Screen Component
 */
export const TradingScreen: React.FC<TradingScreenProps> = () => {
  // State
  const [trader, setTrader] = useState<TraderClient | null>(null);
  const [feed, setFeed] = useState<FeedClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<Decimal>(new Decimal(0));
  const [positions, setPositions] = useState<Position[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  
  // Form state
  const [selectedPair, setSelectedPair] = useState('ETH/USD');
  const [orderSize, setOrderSize] = useState('100');
  const [leverage, setLeverage] = useState('10');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  // Initialize SDK
  useEffect(() => {
    initializeSDK();
    return () => {
      if (trader) trader.disconnect();
      if (feed) feed.disconnect();
    };
  }, []);

  const initializeSDK = async () => {
    try {
      // Initialize clients
      const traderClient = new TraderClient('base');
      const feedClient = new FeedClient({ network: 'base' });

      // Get stored private key from secure storage
      const privateKey = await SecureStore.getItemAsync('privateKey');
      if (!privateKey) {
        Alert.alert('Error', 'Please set up your wallet first');
        return;
      }

      // Connect wallet
      await traderClient.setSigner({
        type: 'privateKey',
        privateKey,
      });

      await feedClient.connect();

      setTrader(traderClient);
      setFeed(feedClient);
      setConnected(true);

      // Load initial data
      await loadAccountData(traderClient);
      await loadMarketData(feedClient);
    } catch (error) {
      console.error('Failed to initialize SDK:', error);
      Alert.alert('Connection Error', 'Failed to connect to Avantis');
    }
  };

  const loadAccountData = async (traderClient: TraderClient) => {
    try {
      const [usdcBalance, userPositions] = await Promise.all([
        traderClient.getUSDCBalance(),
        traderClient.getPositions(),
      ]);

      setBalance(usdcBalance);
      setPositions(userPositions);
    } catch (error) {
      console.error('Failed to load account data:', error);
    }
  };

  const loadMarketData = async (feedClient: FeedClient) => {
    try {
      const pairs = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
      const prices = await feedClient.getMultiplePrices(pairs);
      
      const data: MarketData[] = [];
      prices.forEach((priceData, pair) => {
        data.push({
          pair,
          price: priceData.price,
          change24h: 0, // Would fetch from market stats
        });
      });
      
      setMarketData(data);
    } catch (error) {
      console.error('Failed to load market data:', error);
    }
  };

  /**
   * Execute Market Order
   */
  const executeMarketOrder = async (side: PositionSide) => {
    if (!trader || !feed) {
      Alert.alert('Error', 'Not connected to Avantis');
      return;
    }

    setLoading(true);

    try {
      // Validate inputs
      const size = new Decimal(orderSize);
      const lev = parseInt(leverage);

      if (size.lte(0) || lev <= 0 || lev > 100) {
        Alert.alert('Invalid Input', 'Please check your order parameters');
        return;
      }

      // Check balance
      const requiredCollateral = size.div(lev);
      if (balance.lt(requiredCollateral)) {
        Alert.alert(
          'Insufficient Balance',
          `You need ${formatUSDC(requiredCollateral)} USDC but only have ${formatUSDC(balance)}`
        );
        return;
      }

      // Get current price
      const priceData = await feed.getLatestPrice(selectedPair);

      // Prepare order parameters
      const params = {
        pair: selectedPair,
        side,
        size,
        leverage: lev,
        stopLoss: stopLoss ? new Decimal(stopLoss) : undefined,
        takeProfit: takeProfit ? new Decimal(takeProfit) : undefined,
        slippage: 0.5,
      };

      // Show confirmation
      Alert.alert(
        'Confirm Order',
        `${side === PositionSide.LONG ? 'Buy' : 'Sell'} ${selectedPair}\n` +
        `Size: $${size}\n` +
        `Leverage: ${lev}x\n` +
        `Entry Price: ${formatPrice(priceData.price)}\n` +
        `Collateral: ${formatUSDC(requiredCollateral)}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              const result = await trader.openPosition(params);
              
              if (result.success) {
                Alert.alert('✅ Success', `Position opened!\nTX: ${result.transactionHash}`);
                await loadAccountData(trader);
              } else {
                Alert.alert('❌ Error', result.error || 'Failed to open position');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to execute order');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Close Position
   */
  const closePosition = async (positionId: string) => {
    if (!trader) return;

    Alert.alert(
      'Close Position',
      'Are you sure you want to close this position?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await trader.closePosition({
                positionId,
                slippage: 0.5,
              });

              if (result.success) {
                Alert.alert('Success', 'Position closed successfully');
                await loadAccountData(trader);
              } else {
                Alert.alert('Error', 'Failed to close position');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Avantis Trading</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: connected ? '#4CAF50' : '#f44336' }]} />
            <Text style={styles.statusText}>{connected ? 'Connected' : 'Disconnected'}</Text>
          </View>
        </View>

        {/* Balance */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>USDC Balance</Text>
          <Text style={styles.balanceValue}>{formatUSDC(balance)}</Text>
        </View>

        {/* Market Prices */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Markets</Text>
          {marketData.map((market) => (
            <TouchableOpacity
              key={market.pair}
              style={[styles.marketItem, selectedPair === market.pair && styles.selectedMarket]}
              onPress={() => setSelectedPair(market.pair)}
            >
              <Text style={styles.marketPair}>{market.pair}</Text>
              <Text style={styles.marketPrice}>{formatPrice(market.price)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Order Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New Order - {selectedPair}</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Size (USD)"
            value={orderSize}
            onChangeText={setOrderSize}
            keyboardType="numeric"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Leverage (1-100)"
            value={leverage}
            onChangeText={setLeverage}
            keyboardType="numeric"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Stop Loss (Optional)"
            value={stopLoss}
            onChangeText={setStopLoss}
            keyboardType="numeric"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Take Profit (Optional)"
            value={takeProfit}
            onChangeText={setTakeProfit}
            keyboardType="numeric"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.buyButton]}
              onPress={() => executeMarketOrder(PositionSide.LONG)}
              disabled={loading || !connected}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Buy / Long</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.sellButton]}
              onPress={() => executeMarketOrder(PositionSide.SHORT)}
              disabled={loading || !connected}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Sell / Short</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Open Positions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Positions</Text>
          {positions.length === 0 ? (
            <Text style={styles.emptyText}>No open positions</Text>
          ) : (
            positions.map((position) => (
              <View key={position.id} style={styles.positionCard}>
                <View style={styles.positionHeader}>
                  <Text style={styles.positionPair}>{position.pair}</Text>
                  <Text style={[styles.positionSide, { color: position.side === PositionSide.LONG ? '#4CAF50' : '#f44336' }]}>
                    {position.side.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.positionDetail}>Size: {formatUSDC(position.size)}</Text>
                <Text style={styles.positionDetail}>Leverage: {position.leverage}x</Text>
                <Text style={styles.positionDetail}>Entry: {formatPrice(position.entryPrice)}</Text>
                {position.unrealizedPnl && (
                  <Text style={[styles.positionPnl, { color: position.unrealizedPnl.gte(0) ? '#4CAF50' : '#f44336' }]}>
                    PnL: {formatPnL(position.unrealizedPnl).value}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => closePosition(position.id)}
                >
                  <Text style={styles.closeButtonText}>Close Position</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  balanceCard: {
    backgroundColor: 'white',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    margin: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  marketItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedMarket: {
    borderColor: '#2196F3',
  },
  marketPair: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  marketPrice: {
    fontSize: 16,
    color: '#666',
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: '#4CAF50',
  },
  sellButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  positionCard: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 1,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  positionPair: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  positionSide: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  positionDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  positionPnl: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  closeButton: {
    backgroundColor: '#ff9800',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 8,
  },
});

export default TradingScreen;