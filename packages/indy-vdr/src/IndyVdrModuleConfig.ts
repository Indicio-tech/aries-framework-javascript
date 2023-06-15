import type { IndyVdrPoolConfig } from './pool'
import type { VdrPoolConfig } from './vdrProxy'
import type { IndyVdr } from '@hyperledger/indy-vdr-shared'

export interface IndyVdrModuleConfigOptions {
  /**
   *
   * ## Node.JS
   *
   * ```ts
   * import { indyVdr } from '@hyperledger/indy-vdr-nodejs';
   *
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   indyVdr: new IndyVdrModule({
   *      indyVdr,
   *   })
   *  }
   * })
   * ```
   *
   * ## React Native
   *
   * ```ts
   * import { indyVdr } from '@hyperledger/indy-vdr-react-native';
   *
   * const agent = new Agent({
   *  config: {},
   *  dependencies: agentDependencies,
   *  modules: {
   *   indyVdr: new IndyVdrModule({
   *      indyVdr,
   *   })
   *  }
   * })
   * ```
   */
  indyVdr: IndyVdr

  /**
   * Array of indy networks to connect to.
   *
   * @default []
   *
   * @example
   * ```
   * {
   *   isProduction: false,
   *   genesisTransactions: 'xxx',
   *   indyNamespace: 'localhost:test',
   *   transactionAuthorAgreement: {
   *     version: '1',
   *     acceptanceMechanism: 'accept'
   *   }
   * }
   * ```
   */
  networks: [IndyVdrPoolConfig, ...IndyVdrPoolConfig[]]

  proxyNetworks?: [VdrPoolConfig, ...VdrPoolConfig[]]
  useProxy?: boolean
}

export class IndyVdrModuleConfig {
  private options: IndyVdrModuleConfigOptions

  public constructor(options: IndyVdrModuleConfigOptions) {
    this.options = options
  }

  /** See {@link IndyVdrModuleConfigOptions.networks} */
  public get networks() {
    return this.options.networks
  }

  /** See {@link IndyVdrModuleConfigOptions.indyVdr} */
  public get indyVdr() {
    return this.options.indyVdr
  }

  public get proxyNetworks() {
    return this.options.proxyNetworks
  }

  public get useProxy() {
    if (this.options.useProxy !== undefined) return this.options.useProxy
    return false
  }
}
