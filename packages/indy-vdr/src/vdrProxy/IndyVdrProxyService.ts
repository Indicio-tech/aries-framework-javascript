import type { AgentContext } from '@aries-framework/core'
import type { default as Indy, Schema } from 'indy-sdk'

import {
  CacheModuleConfig,
  AgentDependencies,
  InjectionSymbols,
  Logger,
  injectable,
  inject,
} from '@aries-framework/core'

import { allSettled, onlyFulfilled, onlyRejected } from '@aries-framework/core/src/utils/promises'
import { CachedDidResponse } from '../pool'
import { isSelfCertifiedDid } from '../utils/did'
import {
  AnonCredsRevocationRegistryDefinition,
  GetCredentialDefinitionReturn,
  GetRevocationRegistryDefinitionReturn,
  GetRevocationStatusListReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
  RegisterSchemaOptions,
} from '@aries-framework/anoncreds'
import { parseIndyDid } from '../dids/didIndyUtil'
import {
  getDidIndyCredentialDefinitionId,
  getDidIndySchemaId,
  getLegacyCredentialDefinitionId,
  getLegacyRevocationRegistryId,
  getLegacySchemaId,
  parseCredentialDefinitionId,
  parseRevocationRegistryId,
  parseSchemaId,
} from '../anoncreds/utils/identifiers'
import {
  CredentialDefinitionRequest,
  GetCredentialDefinitionRequest,
  GetNymRequest,
  GetRevocationRegistryDefinitionRequest,
  GetRevocationRegistryDeltaRequest,
  GetSchemaRequest,
  GetTransactionRequest,
  IndyVdrRequest,
  SchemaRequest,
} from '@hyperledger/indy-vdr-shared'
import { PublicDidRequestVDR, VdrPoolConfig, VdrPoolProxy } from './VdrPoolProxy'
import { anonCredsRevocationStatusListFromIndyVdr } from '../anoncreds/utils/transform'
import { IndyVdrError, IndyVdrNotFoundError, IndyVdrNotConfiguredError } from '../error'

@injectable()
export class IndyVDRProxyService {
  private logger: Logger
  private pools: VdrPoolProxy[] = []
  private agentDependencies: AgentDependencies
  private indy: typeof Indy

  public constructor(
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger,
    pools: VdrPoolConfig[],
    indy: typeof Indy
  ) {
    this.indy = indy
    this.logger = logger
    this.setPools(pools)
    this.agentDependencies = agentDependencies
  }

  public setPools(poolsConfigs: VdrPoolConfig[]) {
    const pools = poolsConfigs.map((config) => {
      return new VdrPoolProxy(this.agentDependencies, config)
    })
    this.pools = pools
  }

  public addNodeToPools(node: VdrPoolProxy[]) {
    this.pools = [...this.pools, ...node]
  }

  public async registerSchema(
    agentContext: AgentContext,
    did: string,
    options: RegisterSchemaOptions
  ): Promise<Schema> {
    const pool = this.getPoolForNamespace()

    try {
      this.logger.debug(`Register schema on ledger '${pool.id}' with did '${did}'`, options)
      const { namespaceIdentifier } = parseIndyDid(options.schema.issuerId)
      const legacySchemaId = getLegacySchemaId(namespaceIdentifier, options.schema.name, options.schema.version)

      const schema = {
        id: legacySchemaId,
        name: options.schema.name,
        ver: '1.0' as '1.0',
        version: options.schema.version,
        attrNames: options.schema.attrNames,
        seqNo: undefined as number | undefined,
      }

      const request = new SchemaRequest({
        submitterDid: namespaceIdentifier,
        schema: schema,
      })

      const response = await pool.submitWriteRequest(request)
      this.logger.debug(`Registered schema '${legacySchemaId}' on ledger '${pool.id}'`, {
        response,
      })

      schema.seqNo = response.result.txnMetadata.seqNo
      //@ts-ignore
      return schema
    } catch (error) {
      this.logger.error(`Error registering schema for did '${did}' on ledger '${pool.id}'`, {
        error,
        did,
        options,
      })

      throw error
    }
  }

  public async getSchema(agentContext: AgentContext, schemaId: string) {
    const { did, namespaceIdentifier, schemaName, schemaVersion } = parseSchemaId(schemaId)
    const { pool } = await this.getPoolForDid(agentContext, did)

    try {
      this.logger.debug(`Getting schema '${schemaId}' from ledger '${pool.id}'`)

      const legacySchemaId = getLegacySchemaId(namespaceIdentifier, schemaName, schemaVersion)
      const request = new GetSchemaRequest({ schemaId: legacySchemaId })

      this.logger.trace(`Submitting get schema request for schema '${schemaId}' to ledger '${pool.id}'`)
      const response = await pool.submitReadRequest(request)

      this.logger.trace(`Got un-parsed schema '${schemaId}' from ledger '${pool.id}'`, {
        response,
      })

      if (!('attr_names' in response.result.data)) {
        agentContext.config.logger.error(`Error retrieving schema '${schemaId}'`)

        return {
          schemaId,
          resolutionMetadata: {
            error: 'notFound',
            message: `unable to find schema with id ${schemaId}`,
          },
          schemaMetadata: {},
        }
      }

      return {
        schema: {
          attrNames: response.result.data.attr_names,
          name: response.result.data.name,
          version: response.result.data.version,
          issuerId: did,
        },
        schemaId,
        resolutionMetadata: {},
        schemaMetadata: {
          didIndyNamespace: pool.didIndyNamespace,
          // NOTE: the seqNo is required by the indy-sdk even though not present in AnonCreds v1.
          // For this reason we return it in the metadata.
          indyLedgerSeqNo: response.result.seqNo,
        },
      }
    } catch (error) {
      this.logger.error(`Error retrieving schema '${schemaId}' from ledger '${pool.id}'`, {
        error,
        schemaId,
      })
    }
    return {
      schemaId,
      resolutionMetadata: {
        error: 'notFound',
      },
      schemaMetadata: {},
    }
  }

  private async fetchIndySchemaWithSeqNo(agentContext: AgentContext, seqNo: number, did: string) {
    const pool = this.getPoolForNamespace()

    agentContext.config.logger.debug(`Getting transaction with seqNo '${seqNo}' from ledger '${pool.didIndyNamespace}'`)
    // ledgerType 1 is domain ledger
    const request = new GetTransactionRequest({ ledgerType: 1, seqNo })

    agentContext.config.logger.trace(`Submitting get transaction request to ledger '${pool.didIndyNamespace}'`)
    const response = await pool.submitReadRequest(request)

    if (response.result.data?.txn.type !== '101') {
      agentContext.config.logger.error(`Could not get schema from ledger for seq no ${seqNo}'`)
      return null
    }

    const schema = response.result.data?.txn.data as {
      data: {
        attr_names: string[]
        version: string
        name: string
      }
    }

    const schemaId = getLegacySchemaId(did, schema.data.name, schema.data.version)

    return {
      schema: {
        schemaId,
        attr_name: schema.data.attr_names,
        name: schema.data.name,
        version: schema.data.version,
        issuerId: did,
        seqNo,
      },
      indyNamespace: pool.didIndyNamespace,
    }
  }

  public async registerCredentialDefinition(
    agentContext: AgentContext,

    did: string,

    options: RegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    const pool = this.getPoolForNamespace()

    try {
      this.logger.debug(`Registering credential definition on ledger '${pool.id}' with did '${did}'`, options)
      const { schema, schemaMetadata, resolutionMetadata } = await this.getSchema(
        agentContext,
        options.credentialDefinition.schemaId
      )
      const { namespaceIdentifier, namespace } = parseIndyDid(options.credentialDefinition.issuerId)

      if (!schema || !schemaMetadata.indyLedgerSeqNo || typeof schemaMetadata.indyLedgerSeqNo != 'number') {
        return {
          registrationMetadata: {},
          credentialDefinitionMetadata: {
            didIndyNamespace: pool.didIndyNamespace,
          },
          credentialDefinitionState: {
            credentialDefinition: options.credentialDefinition,
            state: 'failed',
            reason: `error resolving schema with id ${options.credentialDefinition.schemaId}: ${resolutionMetadata.error} ${resolutionMetadata.message}`,
          },
        }
      }

      const legacyCredentialDefinitionId = getLegacyCredentialDefinitionId(
        options.credentialDefinition.issuerId,
        schemaMetadata.indyLedgerSeqNo,
        options.credentialDefinition.tag
      )
      const didIndyCredentialDefinitionId = getDidIndyCredentialDefinitionId(
        namespace,
        namespaceIdentifier,
        schemaMetadata.indyLedgerSeqNo,
        options.credentialDefinition.tag
      )

      const request = new CredentialDefinitionRequest({
        submitterDid: namespaceIdentifier,
        credentialDefinition: {
          ver: '1.0',
          id: legacyCredentialDefinitionId,
          schemaId: `${schemaMetadata.indyLedgerSeqNo}`,
          type: 'CL',
          tag: options.credentialDefinition.tag,
          value: options.credentialDefinition.value,
        },
      })

      const response = await pool.submitWriteRequest(request)

      this.logger.debug(
        `Registered credential definition '${options.credentialDefinition.schemaId}' on ledger '${pool.id}'`,
        {
          response,
          credentialDefinition: options.credentialDefinition,
        }
      )

      return {
        credentialDefinitionMetadata: {},
        credentialDefinitionState: {
          credentialDefinition: options.credentialDefinition,
          credentialDefinitionId: didIndyCredentialDefinitionId,
          state: 'finished',
        },
        registrationMetadata: {},
      }
    } catch (error) {
      this.logger.error(
        `Error registering credential definition for schema '${options.credentialDefinition.schemaId}' on ledger '${pool.id}'`,
        {
          error,
          did,
          CredentialDefinition: options.credentialDefinition,
        }
      )

      return {
        credentialDefinitionMetadata: {},
        registrationMetadata: {},
        credentialDefinitionState: {
          credentialDefinition: options.credentialDefinition,
          state: 'failed',
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }

  public async getCredentialDefinition(
    agentContext: AgentContext,
    credentialDefinitionId: string
  ): Promise<GetCredentialDefinitionReturn> {
    const { did, namespaceIdentifier, schemaSeqNo, tag } = parseCredentialDefinitionId(credentialDefinitionId)
    const { pool } = await this.getPoolForDid(agentContext, did)

    this.logger.debug(`Using ledger '${pool.id}' to retrieve credential definition '${credentialDefinitionId}'`)

    try {
      const legacyCredentialDefinitionId = getLegacyCredentialDefinitionId(namespaceIdentifier, schemaSeqNo, tag)
      const request = new GetCredentialDefinitionRequest({
        credentialDefinitionId: legacyCredentialDefinitionId,
      })

      this.logger.trace(
        `Submitting get credential definition request for credential definition '${credentialDefinitionId}' to leder '${pool.id}'`
      )

      const response = await pool.submitReadRequest(request)
      this.logger.trace(
        `Got un-parsed credential definition '${credentialDefinitionId}' from ledger '${pool.id}`,
        response
      )

      const schema = await this.fetchIndySchemaWithSeqNo(agentContext, response.result.ref, namespaceIdentifier)

      if (!schema || !response.result.data) {
        this.logger.error(`Error retrieving credential definition '${credentialDefinitionId}'`)

        return {
          credentialDefinitionId,
          credentialDefinitionMetadata: {},
          resolutionMetadata: {
            error: 'notFound',
            message: `unable to resolve credential definition with id ${credentialDefinitionId}`,
          },
        }
      }
      const schemaId = credentialDefinitionId.startsWith('did:indy')
        ? getDidIndySchemaId(pool.didIndyNamespace, namespaceIdentifier, schema.schema.name, schema.schema.version)
        : schema.schema.schemaId

      return {
        credentialDefinitionId: credentialDefinitionId,
        credentialDefinition: {
          issuerId: did,
          schemaId,
          tag: response.result.tag,
          type: 'CL',
          value: response.result.data,
        },
        credentialDefinitionMetadata: {
          didIndyNamespace: pool.didIndyNamespace,
        },
        resolutionMetadata: {},
      }
    } catch (error) {
      this.logger.error(`Error retrieving credential definition '${credentialDefinitionId}' from ledger '${pool.id}'`, {
        error,
        credentialDefinitionId,
        pool: pool.id,
      })

      return {
        credentialDefinitionId,
        credentialDefinitionMetadata: {},
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve credential definition: ${error.message}`,
        },
      }
    }
  }

  public async getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    const { did, namespaceIdentifier, credentialDefinitionTag, revocationRegistryTag, schemaSeqNo } =
      parseRevocationRegistryId(revocationRegistryDefinitionId)
    const { pool } = await this.getPoolForDid(agentContext, did)

    this.logger.debug(
      `Using ledger '${pool.id}' to retrieve revocation registry definition '${revocationRegistryDefinitionId}'`
    )
    try {
      const legacyRevocationRegistryId = getLegacyRevocationRegistryId(
        namespaceIdentifier,
        schemaSeqNo,
        credentialDefinitionTag,
        revocationRegistryTag
      )
      const request = new GetRevocationRegistryDefinitionRequest({
        revocationRegistryId: legacyRevocationRegistryId,
      })

      this.logger.trace(
        `Submitting get revocation registry definition request for revocation registry definition '${revocationRegistryDefinitionId}' to ledger`
      )
      const response = await pool.submitReadRequest(request)

      if (!response.result.data) {
        this.logger.error(
          `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}' from ledger`,
          {
            revocationRegistryDefinitionId,
          }
        )

        return {
          resolutionMetadata: {
            error: 'notFound',
            message: `unable to resolve revocation registry definition`,
          },
          revocationRegistryDefinitionId,
          revocationRegistryDefinitionMetadata: {},
        }
      }
      this.logger.trace(
        `Got revocation registry definition '${revocationRegistryDefinitionId}' from ledger '${pool.didIndyNamespace}'`,
        {
          response,
        }
      )

      const credentialDefinitionId = revocationRegistryDefinitionId.startsWith('did:indy:')
        ? getDidIndyCredentialDefinitionId(
            pool.didIndyNamespace,
            namespaceIdentifier,
            schemaSeqNo,
            credentialDefinitionTag
          )
        : getLegacyCredentialDefinitionId(namespaceIdentifier, schemaSeqNo, credentialDefinitionTag)

      const revocationRegistryDefinition = {
        issuerId: did,
        revocDefType: response.result.data.revocDefType,
        value: {
          maxCredNum: response.result.data.value.maxCredNum,
          tailsHash: response.result.data.value.tailsHash,
          tailsLocation: response.result.data.value.tailsLocation,
          publicKeys: {
            accumKey: {
              z: response.result.data.value.publicKeys.accumKey.z,
            },
          },
        },
        tag: response.result.data.tag,
        credDefId: credentialDefinitionId,
      } satisfies AnonCredsRevocationRegistryDefinition

      return {
        revocationRegistryDefinitionId,
        revocationRegistryDefinition,
        revocationRegistryDefinitionMetadata: {
          issuanceType: response.result.data.value.issuanceType,
          didIndyNamespace: pool.didIndyNamespace,
        },
        resolutionMetadata: {},
      }
    } catch (error) {
      this.logger.error(
        `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}' from ledger`,
        {
          error,
          revocationRegistryDefinitionId: revocationRegistryDefinitionId,
          pool: pool.id,
        }
      )

      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve revocation registry definition: ${error.message}`,
        },
        revocationRegistryDefinitionId,
        revocationRegistryDefinitionMetadata: {},
      }
    }
  }

  public async getRevocationStatusList(
    agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    const { did, namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag } =
      parseRevocationRegistryId(revocationRegistryId)
    const { pool } = await this.getPoolForDid(agentContext, did)

    this.logger.debug(
      `Using ledger '${pool.didIndyNamespace}' to retrieve revocation registry deltas with revocation registry definition id '${revocationRegistryId}' until ${timestamp}`
    )

    try {
      const legacyRevocationRegistryId = getLegacyRevocationRegistryId(
        namespaceIdentifier,
        schemaSeqNo,
        credentialDefinitionTag,
        revocationRegistryTag
      )
      const request = new GetRevocationRegistryDeltaRequest({
        revocationRegistryId: legacyRevocationRegistryId,
        toTs: timestamp,
      })

      this.logger.trace(
        `Submitting get revocation registry delta request for revocation registry '${revocationRegistryId}' to ledger`
      )

      const response = await pool.submitReadRequest(request)
      this.logger.debug(
        `Got revocation registry deltas '${revocationRegistryId}' until timestamp ${timestamp} from ledger`
      )

      const { revocationRegistryDefinition, resolutionMetadata, revocationRegistryDefinitionMetadata } =
        await this.getRevocationRegistryDefinition(agentContext, revocationRegistryId)

      if (
        !revocationRegistryDefinition ||
        !revocationRegistryDefinitionMetadata.issuanceType ||
        typeof revocationRegistryDefinitionMetadata.issuanceType !== 'string'
      ) {
        return {
          resolutionMetadata: {
            error: `error resolving revocation registry definition with id ${revocationRegistryId}: ${resolutionMetadata.error} ${resolutionMetadata.message}`,
          },
          revocationStatusListMetadata: {
            didIndyNamespace: pool.didIndyNamespace,
          },
        }
      }

      const isIssuanceByDefault = revocationRegistryDefinitionMetadata.issuanceType === 'ISSUANCE_BY_DEFAULT'

      if (!response.result.data) {
        return {
          resolutionMetadata: {
            error: 'notFound',
            message: `Error retrieving revocation registry delta '${revocationRegistryId}' from ledger, potentially revocation interval ends before revocation registry creation`,
          },
          revocationStatusListMetadata: {},
        }
      }

      const revocationRegistryDelta = {
        accum: response.result.data.value.accum_to.value.accum,
        issued: response.result.data.value.issued,
        revoked: response.result.data.value.revoked,
      }

      return {
        resolutionMetadata: {},
        revocationStatusList: anonCredsRevocationStatusListFromIndyVdr(
          revocationRegistryId,
          revocationRegistryDefinition,
          revocationRegistryDelta,
          response.result.data.value.accum_to.txnTime,
          isIssuanceByDefault
        ),
        revocationStatusListMetadata: {
          didIndyNamespace: pool.didIndyNamespace,
        },
      }
    } catch (error) {
      this.logger.error(
        `Error retrieving revocation registry delta '${revocationRegistryId}' from ledger, potentially revocation interval ends before revocation registry creation?"`,
        {
          error,
          revocationRegistryId: revocationRegistryId,
          pool: pool.id,
        }
      )

      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `Error retrieving revocation registry delta '${revocationRegistryId}' from ledger, potentially revocation interval ends before revocation registry creation: ${error.message}`,
        },
        revocationStatusListMetadata: {},
      }
    }
  }

  //VDR specfic functions

  public async sendRequest<Request extends IndyVdrRequest>(request: Request, agentContext: AgentContext, did: string) {
    const { pool } = await this.getPoolForDid(agentContext, did)
    const response = await pool.submitReadRequest(request)
    return response
  }

  //VDR pool selection functions

  public async getPoolForDid(
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
    const pool = this.pools.find((pool) => pool.didIndyNamespace === cachedNymResponse?.indyNamespace)

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

  private async getDidFromPool(did: string, pool: VdrPoolProxy): Promise<PublicDidRequestVDR> {
    try {
      this.logger.trace(`Get public did '${did}' from ledger '${pool.id}'`)
      const request = new GetNymRequest({ dest: did })

      this.logger.trace(`Submitting get did request for did'${did}' to ledger '${pool.id}'`)
      const response = await pool.submitReadRequest(request)

      if (!response.result.data) {
        throw new IndyVdrNotFoundError(`Did ${did} not found on indy pool with namespace ${pool.didIndyNamespace}`)
      }

      const result = JSON.parse(response.result.data)
      this.logger.trace(`Retieved did '${did}' from ledger '${pool.id}'`, result)

      return {
        did: { nymResponse: { did: result.dest, verkey: result.verkey }, indyNamespace: pool.didIndyNamespace },
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

    const pool = this.pools.find((pool) => pool.didIndyNamespace === indyNamespace)

    if (!pool) {
      throw new Error(`No ledgers found for IndyNamespace '${indyNamespace}'.`)
    }

    return pool
  }
}
