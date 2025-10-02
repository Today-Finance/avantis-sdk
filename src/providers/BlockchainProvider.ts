import { ethers } from 'ethers';
import type { 
  Provider,
  Signer,
  TransactionRequest,
  TransactionResponse,
  TransactionReceipt
} from 'ethers';
import { 
  NetworkConfig,
  SignerConfig,
  TransactionConfig,
  TransactionResult,
  BlockchainEvent,
  EventFilter
} from '../types';
import { 
  NetworkError,
  TransactionError,
  ValidationError,
  ErrorCode,
  handleError
} from '../utils/errors';
import { validateAddress, validatePrivateKey } from '../utils/validation';
import { NETWORKS, DEFAULT_NETWORK, DEFAULTS } from '../constants/networks';

export class BlockchainProvider {
  private provider: Provider;
  private signer?: Signer;
  private network: NetworkConfig;
  private readonly config: {
    confirmations: number;
    timeout: number;
    maxRetries: number;
  };

  constructor(
    networkName: keyof typeof NETWORKS = DEFAULT_NETWORK,
    customRpcUrl?: string
  ) {
    this.network = NETWORKS[networkName];
    
    if (!this.network) {
      throw new NetworkError(`Unknown network: ${networkName}`);
    }

    const rpcUrl = customRpcUrl || this.network.rpcUrl;
    
    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    } catch (error) {
      throw new NetworkError(`Failed to connect to network: ${rpcUrl}`, error);
    }

    this.config = {
      confirmations: DEFAULTS.confirmations,
      timeout: DEFAULTS.timeout,
      maxRetries: DEFAULTS.maxRetries
    };
  }

  /**
   * Sets the signer for transactions
   */
  public setSigner(config: SignerConfig): void {
    try {
      switch (config.type) {
        case 'privateKey':
          if (!config.privateKey) {
            throw new ValidationError('Private key is required');
          }
          validatePrivateKey(config.privateKey);
          this.signer = new ethers.Wallet(config.privateKey, this.provider);
          break;
          
        case 'mnemonic':
          if (!config.mnemonic) {
            throw new ValidationError('Mnemonic is required');
          }
          const wallet = ethers.Wallet.fromPhrase(config.mnemonic);
          this.signer = wallet.connect(this.provider);
          break;
          
        case 'jsonRpc':
          if (!this.provider) {
            throw new NetworkError('Provider not initialized');
          }
          // Use the provider's getSigner method for JSON-RPC signers
          const jsonRpcProvider = this.provider as ethers.JsonRpcProvider;
          jsonRpcProvider.getSigner().then(signer => {
            this.signer = signer;
          });
          break;
          
        case 'injected':
          // For browser-based injected providers (MetaMask, etc.)
          if (config.provider) {
            const injectedProvider = config.provider as ethers.JsonRpcProvider;
            injectedProvider.getSigner().then(signer => {
              this.signer = signer;
            });
          }
          break;
          
        default:
          throw new ValidationError('Invalid signer type');
      }
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets the current signer
   */
  public getSigner(): Signer {
    if (!this.signer) {
      throw new ValidationError('Signer not configured', 'signer');
    }
    return this.signer;
  }

  /**
   * Gets the provider instance
   */
  public getProvider(): Provider {
    return this.provider;
  }

  /**
   * Gets the current network configuration
   */
  public getNetwork(): NetworkConfig {
    return this.network;
  }

  /**
   * Gets the chain ID
   */
  public async getChainId(): Promise<bigint> {
    try {
      const network = await this.provider.getNetwork();
      return network.chainId;
    } catch (error) {
      throw new NetworkError('Failed to get chain ID', error);
    }
  }

  /**
   * Gets the current block number
   */
  public async getBlockNumber(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      throw new NetworkError('Failed to get block number', error);
    }
  }

  /**
   * Gets the balance of an address
   */
  public async getBalance(address?: string): Promise<bigint> {
    try {
      const addr = address || (await this.getSigner().getAddress());
      validateAddress(addr);
      return await this.provider.getBalance(addr);
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets the current gas price
   */
  public async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || 0n;
    } catch (error) {
      throw new NetworkError('Failed to get gas price', error);
    }
  }

  /**
   * Estimates gas for a transaction
   */
  public async estimateGas(transaction: TransactionRequest): Promise<bigint> {
    try {
      return await this.provider.estimateGas(transaction);
    } catch (error) {
      throw new TransactionError(
        ErrorCode.GAS_ESTIMATION_FAILED,
        'Failed to estimate gas',
        undefined,
        error
      );
    }
  }

  /**
   * Sends a transaction
   */
  public async sendTransaction(
    transaction: TransactionRequest,
    config?: TransactionConfig
  ): Promise<TransactionResult> {
    try {
      const signer = this.getSigner();
      
      // Merge transaction with config
      const txRequest: TransactionRequest = {
        ...transaction,
        ...(config?.gasLimit && { gasLimit: config.gasLimit }),
        ...(config?.gasPrice && { gasPrice: config.gasPrice }),
        ...(config?.maxFeePerGas && { maxFeePerGas: config.maxFeePerGas }),
        ...(config?.maxPriorityFeePerGas && { maxPriorityFeePerGas: config.maxPriorityFeePerGas }),
        ...(config?.nonce !== undefined && { nonce: config.nonce })
      };

      // Send the transaction
      const txResponse: TransactionResponse = await signer.sendTransaction(txRequest);
      
      // Wait for confirmation
      const receipt = await this.waitForTransaction(
        txResponse.hash,
        this.config.confirmations
      );

      return {
        hash: txResponse.hash,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        from: receipt.from,
        to: receipt.to || '',
        value: txResponse.value,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.gasPrice,
        status: receipt.status === 1 ? 'success' : 'failed',
        logs: [...receipt.logs]
      };
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Waits for a transaction to be mined
   */
  public async waitForTransaction(
    hash: string,
    confirmations: number = 1
  ): Promise<TransactionReceipt> {
    try {
      const receipt = await this.provider.waitForTransaction(hash, confirmations);
      
      if (!receipt) {
        throw new TransactionError(
          ErrorCode.TRANSACTION_FAILED,
          'Transaction receipt not found',
          hash
        );
      }

      if (receipt.status === 0) {
        throw new TransactionError(
          ErrorCode.TRANSACTION_FAILED,
          'Transaction reverted',
          hash
        );
      }

      return receipt;
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets a transaction by hash
   */
  public async getTransaction(hash: string): Promise<TransactionResponse | null> {
    try {
      return await this.provider.getTransaction(hash);
    } catch (error) {
      throw new NetworkError(`Failed to get transaction: ${hash}`, error);
    }
  }

  /**
   * Gets a transaction receipt
   */
  public async getTransactionReceipt(hash: string): Promise<TransactionReceipt | null> {
    try {
      return await this.provider.getTransactionReceipt(hash);
    } catch (error) {
      throw new NetworkError(`Failed to get transaction receipt: ${hash}`, error);
    }
  }

  /**
   * Queries events from the blockchain
   */
  public async queryEvents(filter: EventFilter): Promise<BlockchainEvent[]> {
    try {
      const logs = await this.provider.getLogs({
        address: filter.address,
        topics: filter.topics,
        fromBlock: filter.fromBlock,
        toBlock: filter.toBlock
      });

      return logs.map(log => ({
        address: log.address,
        topics: log.topics as string[],
        data: log.data,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        blockHash: log.blockHash,
        logIndex: log.index,
        removed: log.removed
      }));
    } catch (error) {
      throw new NetworkError('Failed to query events', error);
    }
  }

  /**
   * Subscribes to new blocks
   */
  public onBlock(callback: (blockNumber: number) => void): void {
    this.provider.on('block', callback);
  }

  /**
   * Unsubscribes from block events
   */
  public offBlock(callback?: (blockNumber: number) => void): void {
    if (callback) {
      this.provider.off('block', callback);
    } else {
      this.provider.removeAllListeners('block');
    }
  }

  /**
   * Checks if connected to the network
   */
  public async isConnected(): Promise<boolean> {
    try {
      await this.provider.getNetwork();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disconnects from the network
   */
  public disconnect(): void {
    this.provider.removeAllListeners();
    if (this.provider.destroy) {
      this.provider.destroy();
    }
  }
}