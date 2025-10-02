import { NetworkConfig } from '../types';
import { NETWORKS } from '../constants/networks';

export interface SDKConfig {
  network: 'base' | 'base-sepolia';
  rpcUrl?: string;
  websocketUrl?: string;
  apiKeys?: {
    alchemy?: string;
    infura?: string;
    quicknode?: string;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enabled: boolean;
  };
  performance?: {
    maxRetries?: number;
    requestTimeout?: number;
    wsReconnectInterval?: number;
  };
}

export class ConfigManager {
  private config: SDKConfig;
  private networkConfig: NetworkConfig;

  constructor(config?: Partial<SDKConfig>) {
    this.config = this.mergeWithDefaults(config);
    this.networkConfig = this.buildNetworkConfig();
  }

  private mergeWithDefaults(config?: Partial<SDKConfig>): SDKConfig {
    return {
      network: config?.network || (process.env.DEFAULT_NETWORK as 'base' | 'base-sepolia') || 'base',
      rpcUrl: config?.rpcUrl || process.env.BASE_RPC_URL,
      websocketUrl: config?.websocketUrl || process.env.BASE_WS_URL,
      apiKeys: {
        alchemy: config?.apiKeys?.alchemy || process.env.ALCHEMY_API_KEY,
        infura: config?.apiKeys?.infura || process.env.INFURA_API_KEY,
        quicknode: config?.apiKeys?.quicknode || process.env.QUICKNODE_API_KEY,
      },
      logging: {
        level: config?.logging?.level || (process.env.LOG_LEVEL as any) || 'info',
        enabled: config?.logging?.enabled ?? true,
      },
      performance: {
        maxRetries: config?.performance?.maxRetries || parseInt(process.env.MAX_RETRIES || '3'),
        requestTimeout: config?.performance?.requestTimeout || parseInt(process.env.REQUEST_TIMEOUT || '30000'),
        wsReconnectInterval: config?.performance?.wsReconnectInterval || parseInt(process.env.WS_RECONNECT_INTERVAL || '5000'),
      },
    };
  }

  private buildNetworkConfig(): NetworkConfig {
    const baseConfig = NETWORKS[this.config.network];
    
    // Override with custom RPC if provided
    if (this.config.rpcUrl) {
      baseConfig.rpcUrl = this.config.rpcUrl;
    }

    // Build WebSocket URL with API key if available
    if (this.config.websocketUrl) {
      baseConfig.websocketUrl = this.config.websocketUrl;
    } else if (this.config.apiKeys?.alchemy && baseConfig.websocketUrl?.includes('YOUR_API_KEY')) {
      baseConfig.websocketUrl = baseConfig.websocketUrl.replace('YOUR_API_KEY', this.config.apiKeys.alchemy);
    }

    return baseConfig;
  }

  public getNetworkConfig(): NetworkConfig {
    return this.networkConfig;
  }

  public getSDKConfig(): SDKConfig {
    return this.config;
  }

  public getRPCUrl(): string {
    // Priority: custom URL > API key URLs > public URL
    if (this.config.rpcUrl) {
      return this.config.rpcUrl;
    }

    if (this.config.apiKeys?.alchemy) {
      return `https://base-${this.config.network === 'base' ? 'mainnet' : 'sepolia'}.g.alchemy.com/v2/${this.config.apiKeys.alchemy}`;
    }

    if (this.config.apiKeys?.infura) {
      return `https://base-${this.config.network === 'base' ? 'mainnet' : 'sepolia'}.infura.io/v3/${this.config.apiKeys.infura}`;
    }

    return this.networkConfig.rpcUrl;
  }

  public getWebSocketUrl(): string | undefined {
    // Priority: custom URL > API key URLs > default
    if (this.config.websocketUrl) {
      return this.config.websocketUrl;
    }

    if (this.config.apiKeys?.alchemy) {
      return `wss://base-${this.config.network === 'base' ? 'mainnet' : 'sepolia'}.g.alchemy.com/v2/${this.config.apiKeys.alchemy}`;
    }

    if (this.config.apiKeys?.infura) {
      return `wss://base-${this.config.network === 'base' ? 'mainnet' : 'sepolia'}.infura.io/ws/v3/${this.config.apiKeys.infura}`;
    }

    return this.networkConfig.websocketUrl;
  }

  public isProduction(): boolean {
    return this.config.network === 'base';
  }

  public isTestnet(): boolean {
    return this.config.network === 'base-sepolia';
  }
}