import type { AgentContext } from '../core/src/agent'
import type {
  CredentialDefinitionTemplate,
  ParseRevocationRegistryDefinitionTemplate,
  ParseRevocationRegistryDeltaTemplate,
  ParseRevocationRegistryTemplate,
  SchemaTemplate,
} from '../core/src/modules/ledger/services/LedgerServiceInterface'
import type { PublicDidRequestVDR, vdrPool } from './vdrPool'
import type { CachedDidResponse } from '@aries-framework/core'
import type { default as Indy, CredDef, Schema } from 'indy-sdk'

import { AgentDependencies } from '../core/src/agent/AgentDependencies'
import { InjectionSymbols } from '../core/src/constants'
import { Logger } from '../core/src/logger'
import { IndyIssuerService } from '../core/src/modules/indy'
import { LedgerError, LedgerNotConfiguredError } from '../core/src/modules/ledger/error'
import { LedgerNotFoundError } from '../core/src/modules/ledger/error/LedgerNotFoundError'
import { LedgerServiceInterface } from '../core/src/modules/ledger/services/LedgerServiceInterface'
import { injectable, inject } from '../core/src/plugins'
import {
  didFromSchemaId,
  isSelfCertifiedDid,
  didFromCredentialDefinitionId,
  didFromRevocationRegistryDefinitionId,
} from '../core/src/utils/did'
import { isIndyError } from '../core/src/utils/indyError'
import { allSettled, onlyFulfilled, onlyRejected } from '../core/src/utils/promises'
import { IndySdkError } from '../indy-sdk/src/error/IndySdkError'

import { CacheModuleConfig } from '@aries-framework/core'

@injectable()
export class IndyVDRProxyService extends LedgerServiceInterface {
  private indy: typeof Indy
  private logger: Logger
  private pools: vdrPool[]
  private indyIssuer: IndyIssuerService

  public constructor(
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger,
    indyIssuer: IndyIssuerService,
    pools: vdrPool[]
  ) {
    super()
    this.indy = agentDependencies.indy
    this.logger = logger
    this.indyIssuer = indyIssuer
    this.pools = pools
  }

  public setPools(poolsConfigs: vdrPool[]) {
    this.pools = poolsConfigs
  }

  public addNodeToPools(node: vdrPool[]) {
    this.pools = [...this.pools, ...node]
  }

  public async registerSchema(
    agentContext: AgentContext,
    did: string,
    schemaTemplate: SchemaTemplate
  ): Promise<Schema> {
    const pool = this.getPoolForNamespace()

    try {
      this.logger.debug(`Register schema on ledger '${pool.id}' with did '${did}'`, schemaTemplate)
      const { name, attributes, version } = schemaTemplate
      const schema = await this.indyIssuer.createSchema(agentContext, { originDid: did, name, version, attributes })

      const request = await this.indy.buildSchemaRequest(did, schema)

      const response = await pool.submitWriteRequest(request)
      this.logger.debug(`Registered schema '${schema.id}' on ledger '${pool.id}'`, {
        response,
        schema,
      })

      schema.seqNo = response.result.txnMetadata.seqNo

      return schema
    } catch (error) {
      this.logger.error(`Error registering schema for did '${did}' on ledger '${pool.id}'`, {
        error,
        did,
        schemaTemplate,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<Schema> {
    const did = didFromSchemaId(schemaId)
    const { pool } = await this.getPoolForDid(agentContext, did)

    try {
      this.logger.debug(`Getting schema '${schemaId}' from ledger '${pool.id}'`)

      const request = await this.indy.buildGetSchemaRequest(null, schemaId)

      this.logger.trace(`Submitting get schema request for schema '${schemaId}' to ledger '${pool.id}'`)
      const response = await pool.submitReadRequest(request)

      this.logger.trace(`Got un-parsed schema '${schemaId}' from ledger '${pool.id}'`, {
        response,
      })

      const [, schema] = await this.indy.parseGetSchemaResponse(response)
      this.logger.debug(`Got schema '${schemaId}' from ledger '${pool.id}'`, {
        schema,
      })

      return schema
    } catch (error) {
      this.logger.error(`Error retrieving schema '${schemaId}' from ledger '${pool.id}'`, {
        error,
        schemaId,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
  public async registerCredentialDefinition(
    agentContext: AgentContext,

    did: string,

    credentialDefinitionTemplate: CredentialDefinitionTemplate
  ): Promise<CredDef> {
    const pool = this.getPoolForNamespace()

    try {
      this.logger.debug(
        `Registering credential definition on ledger '${pool.id}' with did '${did}'`,
        credentialDefinitionTemplate
      )
      const { schema, tag, signatureType, supportRevocation } = credentialDefinitionTemplate

      const credentialDefinition = await this.indyIssuer.createCredentialDefinition(agentContext, {
        issuerDid: did,
        schema,
        tag,
        signatureType,
        supportRevocation,
      })

      const request = await this.indy.buildCredDefRequest(did, credentialDefinition)

      const response = await pool.submitWriteRequest(request)

      this.logger.debug(`Registered credential definition '${credentialDefinition.id}' on ledger '${pool.id}'`, {
        response,
        credentialDefinition: credentialDefinition,
      })

      return credentialDefinition
    } catch (error) {
      this.logger.error(
        `Error registering credential definition for schema '${credentialDefinitionTemplate.schema.id}' on ledger '${pool.id}'`,
        {
          error,
          did,
          credentialDefinitionTemplate,
        }
      )

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async getCredentialDefinition(agentContext: AgentContext, credentialDefinitionId: string): Promise<CredDef> {
    const did = didFromCredentialDefinitionId(credentialDefinitionId)
    const { pool } = await this.getPoolForDid(agentContext, did)

    this.logger.debug(`Using ledger '${pool.id}' to retrieve credential definition '${credentialDefinitionId}'`)

    try {
      const request = await this.indy.buildGetCredDefRequest(null, credentialDefinitionId)

      this.logger.trace(
        `Submitting get credential definition request for credential definition '${credentialDefinitionId}' to leder '${pool.id}'`
      )

      const response = await pool.submitReadRequest(request)
      this.logger.trace(
        `Got un-parsed credential definition '${credentialDefinitionId}' from ledger '${pool.id}`,
        response
      )

      const [, credentialDefinition] = await this.indy.parseGetCredDefResponse(response)
      this.logger.debug(`Got credential definition '${credentialDefinitionId}' from ledger '${pool.id}'`, {
        credentialDefinition,
      })

      return credentialDefinition
    } catch (error) {
      this.logger.error(`Error retrieving credential definition '${credentialDefinitionId}' from ledger '${pool.id}'`, {
        error,
        credentialDefinitionId,
        pool: pool.id,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  public async getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<ParseRevocationRegistryDefinitionTemplate> {
    const did = didFromRevocationRegistryDefinitionId(revocationRegistryDefinitionId)
    const { pool } = await this.getPoolForDid(agentContext, did)

    this.logger.debug(
      `Using ledger '${pool.id}' to retrieve revocation registry definition '${revocationRegistryDefinitionId}'`
    )
    try {
      //TODO - implement a cache
      this.logger.trace(
        `Revocation Registry Definition '${revocationRegistryDefinitionId}' not cached, retrieving from ledger`
      )

      const request = await this.indy.buildGetRevocRegDefRequest(null, revocationRegistryDefinitionId)

      this.logger.trace(
        `Submitting get revocation registry definition request for revocation registry definition '${revocationRegistryDefinitionId}' to ledger`
      )
      const response = await pool.submitReadRequest(request)
      this.logger.trace(
        `Got un-parsed revocation registry definition '${revocationRegistryDefinitionId}' from ledger '${pool.id}'`,
        {
          response,
        }
      )

      const [, revocationRegistryDefinition] = await this.indy.parseGetRevocRegDefResponse(response)

      this.logger.debug(`Got revocation registry definition '${revocationRegistryDefinitionId}' from ledger`, {
        revocationRegistryDefinition,
      })

      return { revocationRegistryDefinition, revocationRegistryDefinitionTxnTime: response.result.txnTime }
    } catch (error) {
      this.logger.error(
        `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}' from ledger`,
        {
          error,
          revocationRegistryDefinitionId: revocationRegistryDefinitionId,
          pool: pool.id,
        }
      )
      throw error
    }
  }

  public async getRevocationRegistryDelta(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    to: number,
    from: number
  ): Promise<ParseRevocationRegistryDeltaTemplate> {
    //TODO - implement a cache
    const did = didFromRevocationRegistryDefinitionId(revocationRegistryDefinitionId)
    const { pool } = await this.getPoolForDid(agentContext, did)

    this.logger.debug(
      `Using ledger '${pool.id}' to retrieve revocation registry delta with revocation registry definition id: '${revocationRegistryDefinitionId}'`,
      {
        to,
        from,
      }
    )

    try {
      const request = await this.indy.buildGetRevocRegDeltaRequest(null, revocationRegistryDefinitionId, from, to)

      this.logger.trace(
        `Submitting get revocation registry delta request for revocation registry '${revocationRegistryDefinitionId}' to ledger`
      )

      const response = await pool.submitReadRequest(request)
      this.logger.trace(
        `Got revocation registry delta unparsed-response '${revocationRegistryDefinitionId}' from ledger`,
        {
          response,
        }
      )

      const [, revocationRegistryDelta, deltaTimestamp] = await this.indy.parseGetRevocRegDeltaResponse(response)

      this.logger.debug(`Got revocation registry delta '${revocationRegistryDefinitionId}' from ledger`, {
        revocationRegistryDelta,
        deltaTimestamp,
        to,
        from,
      })

      return { revocationRegistryDelta, deltaTimestamp }
    } catch (error) {
      this.logger.error(
        `Error retrieving revocation registry delta '${revocationRegistryDefinitionId}' from ledger, potentially revocation interval ends before revocation registry creation?"`,
        {
          error,
          revocationRegistryId: revocationRegistryDefinitionId,
          pool: pool.id,
        }
      )
      throw error
    }
  }

  public async getRevocationRegistry(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<ParseRevocationRegistryTemplate> {
    //TODO - implement a cache
    const did = didFromRevocationRegistryDefinitionId(revocationRegistryDefinitionId)
    const { pool } = await this.getPoolForDid(agentContext, did)

    this.logger.debug(
      `Using ledger '${pool.id}' to retrieve revocation registry accumulated state with revocation registry definition id: '${revocationRegistryDefinitionId}'`,
      {
        timestamp,
      }
    )

    try {
      const request = await this.indy.buildGetRevocRegRequest(null, revocationRegistryDefinitionId, timestamp)

      this.logger.trace(
        `Submitting get revocation registry request for revocation registry '${revocationRegistryDefinitionId}' to ledger`
      )
      const response = await pool.submitReadRequest(request)
      this.logger.trace(
        `Got un-parsed revocation registry '${revocationRegistryDefinitionId}' from ledger '${pool.id}'`,
        {
          response,
        }
      )

      const [, revocationRegistry, ledgerTimestamp] = await this.indy.parseGetRevocRegResponse(response)
      this.logger.debug(`Got revocation registry '${revocationRegistryDefinitionId}' from ledger`, {
        ledgerTimestamp,
        revocationRegistry,
      })

      return { revocationRegistry, ledgerTimestamp }
    } catch (error) {
      this.logger.error(`Error retrieving revocation registry '${revocationRegistryDefinitionId}' from ledger`, {
        error,
        revocationRegistryId: revocationRegistryDefinitionId,
        pool: pool.id,
      })
      throw error
    }
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

    const { successful, rejected } = await this.getSettledDidResponsesFromPools(did, pools)

    if (successful.length === 0) {
      const allNotFound = rejected.every((e) => e.reason instanceof LedgerNotFoundError)
      const rejectedOtherThanNotFound = rejected.filter((e) => !(e.reason instanceof LedgerNotFoundError))

      // All ledgers returned response that the did was not found
      if (allNotFound) {
        throw new LedgerNotFoundError(`Did '${did}' not found on any of the ledgers (total ${this.pools.length}).`)
      }

      // one or more of the ledgers returned an unknown error
      throw new LedgerError(
        `Unknown error retrieving did '${did}' from '${rejectedOtherThanNotFound.length}' of '${pools.length}' ledgers`,
        { cause: rejectedOtherThanNotFound[0].reason }
      )
    }

    // If there are self certified DIDs we always prefer it over non self certified DIDs
    // We take the first self certifying DID as we take the order in the
    // indyLedgers config as the order of preference of ledgers
    let value = successful.find((response) =>
      isSelfCertifiedDid(response.value.did.did, response.value.did.verkey)
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

    await cache.set(agentContext, `IndySdkPoolService:${did}`, {
      nymResponse: value.did,
      poolId: value.pool.id,
    })
    return { pool: value.pool, did: value.did }
  }

  private async getSettledDidResponsesFromPools(did: string, pools: vdrPool[]) {
    this.logger.trace(`Retrieving did '${did}' from ${pools.length} ledgers`)
    const didResponses = await allSettled(pools.map((pool) => this.getDidFromPool(did, pool)))

    const successful = onlyFulfilled(didResponses)
    this.logger.trace(`Retrieved ${successful.length} responses from ledgers for did '${did}'`)

    const rejected = onlyRejected(didResponses)

    return { successful: successful, rejected: rejected }
  }

  private async getDidFromPool(did: string, pool: vdrPool): Promise<PublicDidRequestVDR> {
    try {
      this.logger.trace(`Get public did '${did}' from ledger '${pool.id}'`)
      const request = await this.indy.buildGetNymRequest(null, did)

      this.logger.trace(`Submitting get did request for did'${did}' to ledger '${pool.id}'`)
      const response = await pool.submitReadRequest(request)

      const result = await this.indy.parseGetNymResponse(response)
      this.logger.trace(`Retieved did '${did}' from ledger '${pool.id}'`, result)

      return {
        did: result,
        pool,
        response,
      }
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

  /**
   * Get the most appropriate pool for the given indyNamespace
   */
  public getPoolForNamespace(indyNamespace?: string) {
    if (this.pools.length === 0) {
      throw new LedgerNotConfiguredError(
        "No indy ledgers configured. Provide at least one pool configuration in the 'indyLedgers' agent configuration"
      )
    }

    if (!indyNamespace) {
      this.logger.warn('Not passing the indyNamespace is deprecated and will be removed in the future version.')
      return this.pools[0]
    }

    const pool = this.pools.find((pool) => pool.didIndyNamespace === indyNamespace)

    if (!pool) {
      throw new LedgerNotFoundError(`No ledgers found for IndyNamespace '${indyNamespace}'.`)
    }

    return pool
  }
}
