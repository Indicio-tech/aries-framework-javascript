import type { AgentContext } from '../core/src/agent'
import type {
  CredentialDefinitionTemplate,
  ParseRevocationRegistryDefinitionTemplate,
  ParseRevocationRegistryDeltaTemplate,
  ParseRevocationRegistryTemplate,
  SchemaTemplate,
} from '../core/src/modules/ledger/services/LedgerServiceInterface'
import type { vdrPool } from './vdrPool'
import type { CachedDidResponse } from '@aries-framework/core'
import type { default as Indy, CredDef, Schema } from 'indy-sdk'
import type fetch from 'node-fetch'

import { AgentDependencies } from '../core/src/agent/AgentDependencies'
import { InjectionSymbols } from '../core/src/constants'
import { Logger } from '../core/src/logger'
import { LedgerNotConfiguredError } from '../core/src/modules/ledger/error'
import { LedgerNotFoundError } from '../core/src/modules/ledger/error/LedgerNotFoundError'
import { LedgerServiceInterface } from '../core/src/modules/ledger/services/LedgerServiceInterface'
import { injectable, inject } from '../core/src/plugins'
import { didFromSchemaId } from '../core/src/utils/did'
import { isIndyError } from '../core/src/utils/indyError'
import { allSettled } from '../core/src/utils/promises'
import { IndySdkError } from '../indy-sdk/src/error/IndySdkError'

import { CacheModuleConfig } from '@aries-framework/core'

@injectable()
export class IndyVDRProxyService extends LedgerServiceInterface {
  private indy: typeof Indy
  private logger: Logger
  private pools: vdrPool[]
  private fetch: typeof fetch

  public constructor(
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger,
    pools: vdrPool[]
  ) {
    super()
    this.indy = agentDependencies.indy
    this.logger = logger
    this.pools = pools
    this.fetch = agentDependencies.fetch
  }

  public setPools(poolsConfigs: vdrPool[]): void {
    this.pools = poolsConfigs
  }

  public addNodeToPools(node: vdrPool[]) {
    this.pools = [...this.pools, ...node]
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public registerSchema(agent: AgentContext, did: string, schemaTemplate: SchemaTemplate): Promise<Schema> {
    throw new Error('Write Request are not supported by the VDR Proxy service.')
  }
  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<Schema> {
    const pool = await this.getPoolForDid(agentContext, didFromSchemaId(schemaId))
    return this.getSchemaSingle(agentContext, schemaId, pool.pool.url)
  }
  public registerCredentialDefinition(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    did: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    createCredentialDefinition: CredentialDefinitionTemplate
  ): Promise<CredDef> {
    throw new Error('Write Request are not supported by the VDR Proxy service.')
  }
  public getCredentialDefinition(agentContext: AgentContext, credentialDefinitionId: string): Promise<CredDef> {
    throw new Error('Method not implemented.')
  }
  public getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<ParseRevocationRegistryDefinitionTemplate> {
    throw new Error('Method not implemented.')
  }
  public getRevocationRegistryDelta(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    to: number,
    from: number
  ): Promise<ParseRevocationRegistryDeltaTemplate> {
    throw new Error('Method not implemented.')
  }
  public getRevocationRegistry(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<ParseRevocationRegistryTemplate> {
    throw new Error('Method not implemented.')
  }

  private getSchemaSingle(agentContext: AgentContext, schemaId: string, pool: string): Promise<Schema> {
    throw new Error('Method not implemented.')
  }

  public async getPoolForDid(
    agentContext: AgentContext,
    did: string
  ): Promise<{ pool: vdrPool; did: Indy.GetNymResponse }> {
    const pools = this.pools

    if (pools.length === 0) {
      throw new LedgerNotConfiguredError(
        "No VDR prcoies were configured. Provide at least one ledger in the 'Indy VDR proxy' agent config"
      )
    }

    const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache

    const cachedNymResponse = await cache.get<CachedDidResponse>(agentContext, `IndyVDRPool:${did}`)
    const pool = this.pools.find((pool) => pool.id === cachedNymResponse?.poolId)

    if (cachedNymResponse && pool) {
      this.logger.trace(`Found ledger id '${pool.id}' for did '${did}' in cache`)
      return { did: cachedNymResponse.nymResponse, pool }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { successful, rejected } = await this.getSettledDidResponsesFromPools(did, pools)

    throw new Error('Method not implemented.')
  }

  private getSettledDidResponsesFromPools(did: string, pools: vdrPool[]) {
    this.logger.trace(`Retrieving did '${did}' from ${pools.length} ledgers`)
    //const didResponses = await allSettled(pools.map((pool) => ))
    return { successful: null, rejected: null }
  }

  private async getDidFromPool(did: string, pool: vdrPool): Promise<null> {
    try {
      this.logger.trace(`Get public did '${did}' from ledger '${pool.id}'`)
      const request = await this.indy.buildGetNymRequest(null, did)

      this.logger.trace(`Submitting get did request for did'${did}' to ledger '${pool.id}'`)
      const response = await pool.submitReadRequest(request)
      return null
    } catch (error) {
      this.logger.trace(`Error retrieving did '${did}' from ledger '${pool.id}'`, {
        error,
        did,
      })
      if (isIndyError(error, 'LedgerNotFound')) {
        throw new LedgerNotFoundError(`Did '${did}' not found on ledger ${pool.id}`)
      } else {
        throw isIndyError(error) ? new IndySdkError(error) : error
      }
    }
  }
}
