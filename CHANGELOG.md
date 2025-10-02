# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.1] - 2024-10-02

### ⚠️ Beta Release
- This is an **unofficial**, community-developed SDK
- Not audited or endorsed by Avantis
- Use at your own risk in production

### Added
- Initial beta release of unofficial Avantis TypeScript SDK
- Full trading capabilities (market, limit, stop orders)
- Position management (open, close, update)
- Real-time price feeds via WebSocket
- Platform fee management system with transaction bundling
- Support for 40+ trading pairs across crypto, forex, commodities, and indices
- React Native compatibility
- Comprehensive error handling with custom error types
- Runtime validation using Zod schemas
- TypeScript support with full type definitions
- Multicall3 integration for gas optimization (30-40% savings)
- Referral fee splitting system
- Flexible discount mechanism
- Account information and portfolio tracking
- Examples and comprehensive documentation

### Security
- Input validation on all methods
- No hardcoded secrets or private keys
- Secure transaction handling
- Protected fee calculations with bounds checking

### Performance
- Transaction bundling for gas efficiency
- Optimized for React Native
- Minimal dependencies (6 production deps)
- ~3.2MB bundle size

### Supported Networks
- Base Mainnet (Chain ID: 8453)
- Base Sepolia Testnet (Chain ID: 84532)

---

[1.0.0-beta.1]: https://github.com/avantisfi/avantis-sdk/releases/tag/v1.0.0-beta.1