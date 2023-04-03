import type { CachedDidResponse, PublicDidRequestVDR, VdrPoolConfig } from './VdrPoolProxy'
import type { IndyVdrModuleConfig } from '../IndyVdrModuleConfig'
import type { AgentContext } from '@aries-framework/core'
import type { IndyVdrRequest } from '@hyperledger/indy-vdr-shared'

import {
  CacheModuleConfig,
  AgentDependencies,
  InjectionSymbols,
  Logger,
  injectable,
  inject,
} from '@aries-framework/core'
import { allSettled, onlyFulfilled, onlyRejected } from '@aries-framework/core/src/utils/promises'
import { GetNymRequest } from '@hyperledger/indy-vdr-shared'

import { IndyVdrError, IndyVdrNotFoundError } from '../error'
import { isSelfCertifiedDid, DID_INDY_REGEX } from '../utils/did'

import { VdrPoolProxy } from './VdrPoolProxy'

@injectable()
export class IndyVDRProxyService {
  private logger: Logger
  private pools: VdrPoolProxy[] = []
  private agentDependencies: AgentDependencies
  private config: IndyVdrModuleConfig

  public constructor(
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger,
    IndyVdrModuleConfig: IndyVdrModuleConfig
  ) {
    this.logger = logger
    this.setPools(IndyVdrModuleConfig.proxyNetworks)
    this.agentDependencies = agentDependencies
    this.config = IndyVdrModuleConfig
  }

  public setPools(poolsConfigs: VdrPoolConfig[] | undefined) {
    if (poolsConfigs) {
      const pools = poolsConfigs.map((config) => {
        return new VdrPoolProxy(this.agentDependencies, config)
      })
      this.pools = pools
    }
  }

  public addNodeToPools(node: VdrPoolProxy[]) {
    this.pools = [...this.pools, ...node]
  }

  public get getPools() {
    return this.pools
  }

  //VDR specfic functions

  public async sendRequest<Request extends IndyVdrRequest>(request: Request, agentContext: AgentContext, did: string) {
    const { pool } = await this.getPoolForDid(agentContext, did)
    const response = await pool.submitReadRequest(request)
    return response
  }

  //VDR pool selection functions

  public async getPoolForLegacyDid(
    agentContext: AgentContext,
    did: string
  ): Promise<{ pool: VdrPoolProxy; nymResponse?: CachedDidResponse['nymResponse'] }> {
    const pools = this.pools

    if (pools.length === 0) {
      throw new Error(
        "No VDR proxies were configured. Provide at least one ledger in the 'Indy VDR proxy' agent config"
      )
    }

    const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
    const cacheKey = `IndyVdrProxyService:${did}`

    const cachedNymResponse = await cache.get<CachedDidResponse>(agentContext, cacheKey)
    const pool = this.pools.find((pool) => pool.indyNamespace === cachedNymResponse?.indyNamespace)

    if (cachedNymResponse && pool) {
      this.logger.trace(`Found ledger id '${pool.id}' for did '${did}' in cache`)
      return { nymResponse: cachedNymResponse.nymResponse, pool }
    }

    const { successful, rejected } = await this.getSettledDidResponsesFromPools(did, pools)

    if (successful.length === 0) {
      const allNotFound = rejected.every((e) => e.reason instanceof IndyVdrNotFoundError)
      const rejectedOtherThanNotFound = rejected.filter((e) => !(e.reason instanceof IndyVdrNotFoundError))

      // All ledgers returned response that the did was not found
      if (allNotFound) {
        throw new IndyVdrNotFoundError(`Did '${did}' not found on any of the ledgers (total ${this.pools.length}).`)
      }

      // one or more of the ledgers returned an unknown error
      throw new IndyVdrError(
        `Unknown error retrieving did '${did}' from '${rejectedOtherThanNotFound.length}' of '${pools.length}' ledgers. ${rejectedOtherThanNotFound[0].reason}`,
        { cause: rejectedOtherThanNotFound[0].reason }
      )
    }

    // If there are self certified DIDs we always prefer it over non self certified DIDs
    // We take the first self certifying DID as we take the order in the
    // indyLedgers config as the order of preference of ledgers
    let value = successful.find((response) =>
      isSelfCertifiedDid(response.value.did.nymResponse.did, response.value.did.nymResponse.verkey)
    )?.value

    if (!value) {
      // Split between production and nonProduction ledgers. If there is at least one
      // successful response from a production ledger, only keep production ledgers
      // otherwise we only keep the non production ledgers.
      const production = successful.filter((s) => s.value.pool.config.isProduction)
      const nonProduction = successful.filter((s) => !s.value.pool.config.isProduction)
      const productionOrNonProduction = production.length >= 1 ? production : nonProduction

      // We take the first value as we take the order in the indyLedgers config as
      // the order of preference of ledgers
      value = productionOrNonProduction[0].value
    }

    await cache.set(agentContext, cacheKey, {
      nymResponse: {
        did: value.did.nymResponse.did,
        verkey: value.did.nymResponse.verkey,
      },
      indyNamespace: value.did.indyNamespace,
    })
    return { pool: value.pool, nymResponse: value.did.nymResponse }
  }

  private async getSettledDidResponsesFromPools(did: string, pools: VdrPoolProxy[]) {
    this.logger.trace(`Retrieving did '${did}' from ${pools.length} ledgers`)
    const didResponses = await allSettled(pools.map((pool) => this.getDidFromPool(did, pool)))

    const successful = onlyFulfilled(didResponses)
    this.logger.trace(`Retrieved ${successful.length} responses from ledgers for did '${did}'`)

    const rejected = onlyRejected(didResponses)

    return { successful: successful, rejected: rejected }
  }

  /**
   * Get the most appropriate pool for the given did.
   * If the did is a qualified indy did, the pool will be determined based on the namespace.
   * If it is a legacy unqualified indy did, the pool will be determined based on the algorithm as described in this document:
   * https://docs.google.com/document/d/109C_eMsuZnTnYe2OAd02jAts1vC4axwEKIq7_4dnNVA/edit
   *
   * This method will optionally return a nym response when the did has been resolved to determine the ledger
   * either now or in the past. The nymResponse can be used to prevent multiple ledger quries fetching the same
   * did
   */
  public async getPoolForDid(
    agentContext: AgentContext,
    did: string
  ): Promise<{ pool: VdrPoolProxy; nymResponse?: CachedDidResponse['nymResponse'] }> {
    // Check if the did starts with did:indy
    const match = did.match(DID_INDY_REGEX)

    if (match) {
      const [, namespace] = match

      const pool = this.getPoolForNamespace(namespace)

      if (pool) return { pool }

      throw new IndyVdrError(`Pool for indy namespace '${namespace}' not found`)
    } else {
      return await this.getPoolForLegacyDid(agentContext, did)
    }
  }

  private async getDidFromPool(did: string, pool: VdrPoolProxy): Promise<PublicDidRequestVDR> {
    try {
      this.logger.trace(`Get public did '${did}' from ledger '${pool.id}'`)
      const request = new GetNymRequest({ dest: did })

      this.logger.trace(`Submitting get did request for did'${did}' to ledger '${pool.id}'`)
      const response = await pool.submitReadRequest(request)

      if (!response.result.data) {
        throw new IndyVdrNotFoundError(`Did ${did} not found on indy pool with namespace ${pool.indyNamespace}`)
      }

      const result = JSON.parse(response.result.data)
      this.logger.trace(`Retieved did '${did}' from ledger '${pool.id}'`, result)

      return {
        did: { nymResponse: { did: result.dest, verkey: result.verkey }, indyNamespace: pool.indyNamespace },
        pool,
        response,
      }
    } catch (error) {
      this.logger.trace(`Error retrieving did '${did}' from ledger '${pool.id}'`, {
        error,
        did,
      })

      throw error
    }
  }

  /**
   * Get the most appropriate pool for the given indyNamespace
   */
  public getPoolForNamespace(indyNamespace?: string) {
    if (this.pools.length === 0) {
      throw new Error(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    if (!indyNamespace) {
      this.logger.warn('Not passing the indyNamespace is deprecated and will be removed in the future version.')
      return this.pools[0]
    }

    const pool = this.pools.find((pool) => pool.indyNamespace === indyNamespace)

    if (!pool) {
      throw new Error(`No ledgers found for IndyNamespace '${indyNamespace}'.`)
    }

    return pool
  }
}
