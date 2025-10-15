import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
  type Hash,
  type TransactionReceipt,
  type Log,
  getAddress,
  parseUnits,
} from "viem";
import { privateKeyToAccount, mnemonicToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import {
  NetworkConfig,
  SignerConfig,
  TransactionConfig,
  TransactionResult,
  BlockchainEvent,
  EventFilter,
} from "../types";
import {
  NetworkError,
  TransactionError,
  ValidationError,
  ErrorCode,
  handleError,
} from "../utils/errors";
import { validateAddress, validatePrivateKey } from "../utils/validation";
import { NETWORKS, DEFAULT_NETWORK, DEFAULTS } from "../constants/networks";

// Map our chain IDs to viem chains
const CHAIN_MAP: Record<number, Chain> = {
  8453: base,
  84531: baseSepolia,
};

export class BlockchainProvider {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private account?: Account;
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
    const chain = CHAIN_MAP[this.network.chainId];

    if (!chain) {
      throw new NetworkError(`Unsupported chain ID: ${this.network.chainId}`);
    }

    try {
      this.publicClient = createPublicClient({
        chain,
        transport: http(rpcUrl),
      }) as any;
    } catch (error) {
      throw new NetworkError(`Failed to connect to network: ${rpcUrl}`, error);
    }

    this.config = {
      confirmations: DEFAULTS.confirmations,
      timeout: DEFAULTS.timeout,
      maxRetries: DEFAULTS.maxRetries,
    };
  }

  /**
   * Sets the signer for transactions
   */
  public setSigner(config: SignerConfig): void {
    try {
      const chain = CHAIN_MAP[this.network.chainId];

      switch (config.type) {
        case "privateKey":
          if (!config.privateKey) {
            throw new ValidationError("Private key is required");
          }
          validatePrivateKey(config.privateKey);
          this.account = privateKeyToAccount(
            config.privateKey as `0x${string}`
          );
          this.walletClient = createWalletClient({
            account: this.account,
            chain,
            transport: http(this.network.rpcUrl),
          }) as any;
          break;

        case "mnemonic":
          if (!config.mnemonic) {
            throw new ValidationError("Mnemonic is required");
          }
          this.account = mnemonicToAccount(config.mnemonic);
          this.walletClient = createWalletClient({
            account: this.account,
            chain,
            transport: http(this.network.rpcUrl),
          }) as any;
          break;

        case "jsonRpc":
          // For JSON-RPC signers, we'll use the injected provider pattern
          throw new ValidationError(
            "JSON-RPC signer type not yet supported with viem. Use privateKey or mnemonic instead."
          );

        case "injected":
          // For browser-based injected providers (MetaMask, etc.)
          if (config.provider) {
            // This would need window.ethereum or similar
            throw new ValidationError(
              "Injected provider support coming soon. Use privateKey or mnemonic for now."
            );
          }
          break;

        case "viemClient":
          // NEW: Handle viem WalletClient (like kernel client)
          if (!config.client) {
            throw new ValidationError("Client is required for viemClient type");
          }

          // Store the viem client directly
          this.walletClient = config.client;

          // Get the account from the client
          if (config.client.account) {
            this.account = config.client.account;
          } else {
            throw new ValidationError("Client must have an account");
          }

          console.log(
            "[BlockchainProvider] Set viem wallet client:",
            this.account.address
          );
          break;

        default:
          throw new ValidationError("Invalid signer type");
      }
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets the current signer (wallet client)
   */
  public getSigner(): WalletClient {
    if (!this.walletClient) {
      throw new ValidationError("Signer not configured", "signer");
    }
    return this.walletClient;
  }

  /**
   * Gets the current account
   */
  public getAccount(): Account {
    if (!this.account) {
      throw new ValidationError("Account not configured", "account");
    }
    return this.account;
  }

  /**
   * Gets the provider instance (public client)
   */
  public getProvider(): PublicClient {
    return this.publicClient;
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
      return BigInt(this.network.chainId);
    } catch (error) {
      throw new NetworkError("Failed to get chain ID", error);
    }
  }

  /**
   * Gets the current block number
   */
  public async getBlockNumber(): Promise<number> {
    try {
      const blockNumber = await this.publicClient.getBlockNumber();
      return Number(blockNumber);
    } catch (error) {
      throw new NetworkError("Failed to get block number", error);
    }
  }

  /**
   * Gets the balance of an address
   */
  public async getBalance(address?: string): Promise<bigint> {
    try {
      const addr = address || this.getAccount().address;
      validateAddress(addr);
      return await this.publicClient.getBalance({
        address: addr as `0x${string}`,
      });
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Gets the current gas price
   */
  public async getGasPrice(): Promise<bigint> {
    try {
      const gasPrice = await this.publicClient.getGasPrice();
      return gasPrice;
    } catch (error) {
      throw new NetworkError("Failed to get gas price", error);
    }
  }

  /**
   * Estimates gas for a transaction
   */
  public async estimateGas(transaction: any): Promise<bigint> {
    try {
      const gas = await this.publicClient.estimateGas({
        account: this.account,
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}` | undefined,
        value: transaction.value,
      });
      return gas;
    } catch (error) {
      throw new TransactionError(
        ErrorCode.GAS_ESTIMATION_FAILED,
        "Failed to estimate gas",
        undefined,
        error
      );
    }
  }

  /**
   * Sends a transaction
   */
  public async sendTransaction(
    transaction: any,
    config?: TransactionConfig
  ): Promise<TransactionResult> {
    try {
      const walletClient = this.getSigner();
      const account = this.getAccount();

      // Send the transaction
      const hash = await (walletClient as any).sendTransaction({
        account,
        to: transaction.to as `0x${string}`,
        data: transaction.data as `0x${string}` | undefined,
        value: transaction.value,
        gas: config?.gasLimit,
        gasPrice: config?.gasPrice,
        maxFeePerGas: config?.maxFeePerGas,
        maxPriorityFeePerGas: config?.maxPriorityFeePerGas,
        nonce: config?.nonce,
      });

      // Wait for confirmation
      const receipt = await this.waitForTransaction(
        hash,
        this.config.confirmations
      );

      return {
        hash,
        blockNumber: Number(receipt.blockNumber),
        blockHash: receipt.blockHash,
        from: receipt.from,
        to: receipt.to || "",
        value: BigInt(0), // Would need to parse from transaction
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        status: receipt.status === "success" ? "success" : "failed",
        logs: receipt.logs,
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
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: hash as Hash,
        confirmations,
        timeout: this.config.timeout,
      });

      if (!receipt) {
        throw new TransactionError(
          ErrorCode.TRANSACTION_FAILED,
          "Transaction receipt not found",
          hash
        );
      }

      if (receipt.status === "reverted") {
        throw new TransactionError(
          ErrorCode.TRANSACTION_FAILED,
          "Transaction reverted",
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
  public async getTransaction(hash: string): Promise<any> {
    try {
      return await this.publicClient.getTransaction({ hash: hash as Hash });
    } catch (error) {
      throw new NetworkError(`Failed to get transaction: ${hash}`, error);
    }
  }

  /**
   * Gets a transaction receipt
   */
  public async getTransactionReceipt(
    hash: string
  ): Promise<TransactionReceipt | null> {
    try {
      return await this.publicClient.getTransactionReceipt({
        hash: hash as Hash,
      });
    } catch (error) {
      throw new NetworkError(
        `Failed to get transaction receipt: ${hash}`,
        error
      );
    }
  }

  /**
   * Queries events from the blockchain
   */
  public async queryEvents(filter: EventFilter): Promise<BlockchainEvent[]> {
    try {
      const logs = await (this.publicClient as any).getLogs({
        address: filter.address as `0x${string}` | `0x${string}`[] | undefined,
        topics: filter.topics as any,
        fromBlock:
          typeof filter.fromBlock === "number"
            ? BigInt(filter.fromBlock)
            : (filter.fromBlock as any),
        toBlock:
          typeof filter.toBlock === "number"
            ? BigInt(filter.toBlock)
            : (filter.toBlock as any),
      });

      return logs.map((log: any) => ({
        address: log.address,
        topics: log.topics as string[],
        data: log.data,
        blockNumber: Number(log.blockNumber),
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        blockHash: log.blockHash,
        logIndex: log.logIndex,
        removed: log.removed,
      }));
    } catch (error) {
      throw new NetworkError("Failed to query events", error);
    }
  }

  /**
   * Subscribes to new blocks
   */
  public onBlock(callback: (blockNumber: number) => void): void {
    // viem uses watchBlocks
    this.publicClient.watchBlocks({
      onBlock: (block) => callback(Number(block.number)),
    });
  }

  /**
   * Unsubscribes from block events
   * Note: viem's watchBlocks returns an unwatch function, so this is a simplified version
   */
  public offBlock(callback?: (blockNumber: number) => void): void {
    // In viem, you'd call the unwatch function returned by watchBlocks
    // This is a simplified implementation - in production you'd store the unwatch function
    console.warn(
      "offBlock: viem requires calling the unwatch function returned by watchBlocks"
    );
  }

  /**
   * Checks if connected to the network
   */
  public async isConnected(): Promise<boolean> {
    try {
      await this.publicClient.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disconnects from the network
   * Note: viem clients don't have a disconnect method, connections are managed automatically
   */
  public disconnect(): void {
    // viem handles connection lifecycle automatically
    // No explicit disconnect needed
  }
}
