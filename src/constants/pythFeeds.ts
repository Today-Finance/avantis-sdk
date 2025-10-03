/**
 * Pyth Network Price Feed IDs for all Avantis trading pairs
 * These IDs are used to fetch price update data from the Pyth Hermes API
 *
 * Pyth Contract on Base: 0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a
 */

export const PYTH_PRICE_FEEDS: Record<string, string> = {
  // Crypto pairs (indices 0-24)
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'LINK/USD': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
  'MATIC/USD': '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52',
  'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'XRP/USD': '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8',
  'ADA/USD': '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d',
  'AVAX/USD': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
  'DOT/USD': '0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b',
  'UNI/USD': '0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501',
  'ATOM/USD': '0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819',
  'FTM/USD': '0x5c6c0d2386e3352356c3ab84434fafb5ea067ac2678a38a338c4a69ddc4bdb0c',
  'NEAR/USD': '0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750',
  'ALGO/USD': '0xfa17ceaf30d19ba51112fdcc750cc83454776f47fb0112e4af07f15f4bb1ebc0',
  'AAVE/USD': '0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445',
  'CRV/USD': '0xa19d04ac696c7a6616d291c7e5d1377cc8be437c327b75adb5dc1bad745fcae8',
  'OP/USD': '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf',
  'ARB/USD': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
  'LDO/USD': '0xc63e2a7f37a04e5e614c07238bedb25dcc38927fba8fe890597a593c0b2fa4ad',
  'MKR/USD': '0x9375299e31c0deb9c6bc378e6329aab44cb48ec655552a70d4b9050346a30378',
  'SNX/USD': '0x39d020f60982ed892abbcd4a06a276a9f9b7bfbce003204c110b6e488f502da3',
  'PEPE/USD': '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4',
  'WIF/USD': '0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc',
  'BONK/USD': '0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  'FLOKI/USD': '0x6b1381ce7e874dc5410b197ac8348162c0dd6c0d4c9cd6322672d6c2b1d58293',

  // Forex pairs (indices 25-34)
  'EUR/USD': '0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b',
  'GBP/USD': '0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1',
  'USD/JPY': '0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52',
  'AUD/USD': '0x67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80',
  'USD/CAD': '0x3112b03a41c910ed446852aacf67118cb8f9c3f0eb28f815f2017b5e73b2d5aa',
  'USD/CHF': '0x0b1e3297e69f162877b577b0d6a47a0d63b2392bc8499e6540da4187a63e28f8',
  'NZD/USD': '0x92eea8ba1b00078cdc2ef4baaf85748f9b1b439f79a7c1e587c474eaaa42379e',
  'EUR/GBP': '0x14030d9b5dac22c8f3c36816f7f4f40528f9bf1a5dba059e1f19e09fbf8f1c31',
  'GBP/JPY': '0x45d45ccb1c93d2609c4c5745ce282d3fe51fb0c1acb26f7c2a07ed39e4db5b8d',
  'EUR/JPY': '0xb5d4b0aff09213e74f1bd8a8c05a760fb6d0c96d88bfd0e2a8dfa19bb070b8cf',

  // Commodities (indices 35-38)
  'XAU/USD': '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2',
  'XAG/USD': '0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e',
  'WTI/USD': '0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b',
  'BrentOil/USD': '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',

  // Indices (indices 39-41)
  'SPX500/USD': '0x8f218655050a1476b780185e89f19d2b06e38c08852482277d96c0f919fc7591',
  'NDX100/USD': '0x6ec879b1e9963de5ee97e9c8710b742d6228252a5e2ca12d4ae81d7fe5ee8c5d',
  'DJI/USD': '0xf7a64c6ad4cb0b4ace0dbd152ef30a2b8a5f56ae4cfa9dd82f660d3e2d8c67b9'
};

/**
 * Gets the Pyth price feed ID for a given trading pair
 * @param pair - The trading pair name (e.g., 'BTC/USD')
 * @returns The Pyth price feed ID
 * @throws Error if the pair is not found
 */
export function getPythFeedId(pair: string): string {
  const feedId = PYTH_PRICE_FEEDS[pair];
  if (!feedId) {
    throw new Error(`Pyth price feed ID not found for pair: ${pair}`);
  }
  return feedId;
}

/**
 * Gets Pyth price feed IDs for multiple trading pairs
 * @param pairs - Array of trading pair names
 * @returns Array of Pyth price feed IDs
 */
export function getPythFeedIds(pairs: string[]): string[] {
  return pairs.map(pair => getPythFeedId(pair));
}
