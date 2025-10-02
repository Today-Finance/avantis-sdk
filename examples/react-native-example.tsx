/**
 * React Native / Expo Example
 * 
 * This example demonstrates how to use the Avantis SDK in a React Native trading app
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Button,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet
} from 'react-native';
import { TraderClient, FeedClient, Position, PriceFeedData, AccountInfo } from '@avantis/sdk';
import Decimal from 'decimal.js';

// Import polyfills at the top of your app
import 'react-native-get-random-values';
import '@ethersproject/shims';

const TradingApp: React.FC = () => {
  // State
  const [trader, setTrader] = useState<TraderClient | null>(null);
  const [feed, setFeed] = useState<FeedClient | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [prices, setPrices] = useState<Map<string, PriceFeedData>>(new Map());
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [pair, setPair] = useState('BTC/USD');
  const [size, setSize] = useState('100');
  const [leverage, setLeverage] = useState('10');
  const [side, setSide] = useState<'long' | 'short'>('long');

  // Initialize SDK
  useEffect(() => {
    initializeSDK();
  }, []);

  const initializeSDK = async () => {
    try {
      setLoading(true);
      
      // Initialize trader client
      const traderClient = new TraderClient('base');
      
      // In production, use secure key management
      // This is just for demonstration
      await traderClient.setSigner({
        type: 'privateKey',
        privateKey: process.env.PRIVATE_KEY || '0x...'
      });
      
      setTrader(traderClient);
      
      // Initialize feed client
      const feedClient = new FeedClient();
      await feedClient.connect();
      setFeed(feedClient);
      
      // Subscribe to prices
      subscribeToMarketData(feedClient);
      
      // Load account info
      await loadAccountInfo(traderClient);
      
      setLoading(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to initialize SDK: ' + error.message);
      setLoading(false);
    }
  };

  const subscribeToMarketData = (feedClient: FeedClient) => {
    const pairs = ['BTC/USD', 'ETH/USD', 'EUR/USD'];
    
    pairs.forEach(pair => {
      feedClient.subscribeToPrice(pair, (priceData) => {
        setPrices(prev => new Map(prev).set(pair, priceData));
      });
    });
  };

  const loadAccountInfo = async (traderClient: TraderClient) => {
    try {
      const info = await traderClient.getAccountInfo();
      setAccount(info);
      setPositions(info.positions);
    } catch (error) {
      console.error('Failed to load account info:', error);
    }
  };

  const openPosition = async () => {
    if (!trader) return;
    
    try {
      setLoading(true);
      
      const result = await trader.openPosition({
        pair,
        side: side as any,
        size,
        leverage: parseInt(leverage),
        slippage: 0.5
      });
      
      if (result.success) {
        Alert.alert('Success', `Position opened! TX: ${result.transactionHash.slice(0, 10)}...`);
        await loadAccountInfo(trader);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const closePosition = async (positionId: string) => {
    if (!trader) return;
    
    try {
      setLoading(true);
      
      const result = await trader.closePosition({
        positionId
      });
      
      if (result.success) {
        Alert.alert('Success', 'Position closed successfully');
        await loadAccountInfo(trader);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const approveUSDC = async () => {
    if (!trader) return;
    
    try {
      setLoading(true);
      const result = await trader.approveUSDCForTrading('10000');
      
      if (result.success) {
        Alert.alert('Success', 'USDC approved for trading');
        await loadAccountInfo(trader);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price?: Decimal) => {
    return price ? `$${price.toFixed(2)}` : '-';
  };

  const formatPnL = (pnl: Decimal) => {
    const value = pnl.toNumber();
    const formatted = `$${Math.abs(value).toFixed(2)}`;
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  if (loading && !account) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Account Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text>Address: {account?.address.slice(0, 10)}...</Text>
        <Text>USDC Balance: ${account?.usdcBalance.toFixed(2)}</Text>
        <Text>Free Collateral: ${account?.freeCollateral.toFixed(2)}</Text>
        <Text>Unrealized PnL: {account && formatPnL(account.unrealizedPnl)}</Text>
        <Text>Margin Level: {account?.marginLevel.toFixed(2)}%</Text>
      </View>

      {/* Market Prices */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Market Prices</Text>
        {Array.from(prices.entries()).map(([pair, data]) => (
          <View key={pair} style={styles.priceRow}>
            <Text>{pair}</Text>
            <Text>{formatPrice(data.price)}</Text>
          </View>
        ))}
      </View>

      {/* Open New Position */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Open Position</Text>
        
        <View style={styles.inputGroup}>
          <Text>Pair:</Text>
          <TextInput
            style={styles.input}
            value={pair}
            onChangeText={setPair}
            placeholder="BTC/USD"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text>Size (USDC):</Text>
          <TextInput
            style={styles.input}
            value={size}
            onChangeText={setSize}
            keyboardType="numeric"
            placeholder="100"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text>Leverage:</Text>
          <TextInput
            style={styles.input}
            value={leverage}
            onChangeText={setLeverage}
            keyboardType="numeric"
            placeholder="10"
          />
        </View>
        
        <View style={styles.buttonRow}>
          <Button
            title="LONG"
            onPress={() => {
              setSide('long');
              openPosition();
            }}
            color="green"
            disabled={loading}
          />
          <Button
            title="SHORT"
            onPress={() => {
              setSide('short');
              openPosition();
            }}
            color="red"
            disabled={loading}
          />
        </View>
      </View>

      {/* Open Positions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Open Positions</Text>
        {positions.length === 0 ? (
          <Text>No open positions</Text>
        ) : (
          positions.map((position) => (
            <View key={position.id} style={styles.positionCard}>
              <Text style={styles.positionTitle}>
                {position.pair} - {position.side.toUpperCase()} {position.leverage}x
              </Text>
              <Text>Size: ${position.size.toFixed(2)}</Text>
              <Text>Entry: {formatPrice(position.entryPrice)}</Text>
              <Text>Mark: {formatPrice(position.markPrice)}</Text>
              <Text style={position.unrealizedPnl.gte(0) ? styles.profit : styles.loss}>
                PnL: {formatPnL(position.unrealizedPnl)}
              </Text>
              <Button
                title="Close Position"
                onPress={() => closePosition(position.id)}
                disabled={loading}
              />
            </View>
          ))
        )}
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <Button
          title="Approve USDC for Trading"
          onPress={approveUSDC}
          disabled={loading}
        />
        <View style={{ height: 10 }} />
        <Button
          title="Refresh Account"
          onPress={() => trader && loadAccountInfo(trader)}
          disabled={loading}
        />
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="white" />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  inputGroup: {
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginTop: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  positionCard: {
    padding: 10,
    marginVertical: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  positionTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  profit: {
    color: 'green',
    fontWeight: 'bold',
  },
  loss: {
    color: 'red',
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TradingApp;