/* eslint-disable @typescript-eslint/no-unused-vars */
import type { SchemaTemplate, CredentialDefinitionTemplate } from './services'
import type { VdrPoolConfig } from './services/VdrPoolProxy'
import type { CredDef, NymRole, Schema } from 'indy-sdk'

import { AgentContext } from '../../agent'
import { IndySdkError } from '../../error/IndySdkError'
import { injectable } from '../../plugins'
import { isIndyError } from '../../utils/indyError'
import { AnonCredsCredentialDefinitionRepository } from '../indy/repository/AnonCredsCredentialDefinitionRepository'
import { AnonCredsSchemaRepository } from '../indy/repository/AnonCredsSchemaRepository'

import { LedgerModuleConfig } from './LedgerModuleConfig'
import { IndyVDRProxyService } from './services'

@injectable()
export class LedgerApi {
  public config: LedgerModuleConfig

  private ledgerService: IndyVDRProxyService
  private agentContext: AgentContext
  private anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository
  private anonCredsSchemaRepository: AnonCredsSchemaRepository

  public constructor(
    ledgerService: IndyVDRProxyService,
    agentContext: AgentContext,
    anonCredsCredentialDefinitionRepository: AnonCredsCredentialDefinitionRepository,
    anonCredsSchemaRepository: AnonCredsSchemaRepository,
    config: LedgerModuleConfig
  ) {
    this.ledgerService = ledgerService
    this.agentContext = agentContext
    this.anonCredsCredentialDefinitionRepository = anonCredsCredentialDefinitionRepository
    this.anonCredsSchemaRepository = anonCredsSchemaRepository
    this.config = config
  }

  public setPools(poolConfigs: VdrPoolConfig[]) {
    return this.ledgerService.setPools(poolConfigs)
  }

  /**
   * Connect to all the ledger pools
   */
  public async connectToPools() {
    this.agentContext.config.logger.info("No need, indy-vdr-proxy doesn't need to connect to pools")
  }

  /**
   * @deprecated use agent.dids.create instead
   */
  public async registerPublicDid(did: string, verkey: string, alias: string, role?: NymRole) {
    throw new Error("Deprecated function 'registerPublicDid' called")
  }

  /**
   * @deprecated use agent.dids.resolve instead
   */
  public async getPublicDid(did: string) {
    throw new Error("Deprecated function 'getPublicDid' called")
  }

  public async getSchema(id: string) {
    return this.ledgerService.getSchema(this.agentContext, id)
  }

  public async registerSchema(schema: SchemaTemplate): Promise<Schema> {
    throw new Error("Issuer function: 'registerSchema' called")
  }

  private async findBySchemaIdOnLedger(schemaId: string) {
    try {
      return await this.ledgerService.getSchema(this.agentContext, schemaId)
    } catch (e) {
      if (e instanceof IndySdkError && isIndyError(e.cause, 'LedgerNotFound')) return null

      throw e
    }
  }

  private async findByCredentialDefinitionIdOnLedger(credentialDefinitionId: string): Promise<CredDef | null> {
    try {
      return await this.ledgerService.getCredentialDefinition(this.agentContext, credentialDefinitionId)
    } catch (e) {
      if (e instanceof IndySdkError && isIndyError(e.cause, 'LedgerNotFound')) return null

      throw e
    }
  }

  public async registerCredentialDefinition(
    credentialDefinitionTemplate: Omit<CredentialDefinitionTemplate, 'signatureType'>
  ) {
    throw new Error("Issuer function: 'registerCredentialDefinition' called")
  }

  public async getCredentialDefinition(id: string) {
    return this.ledgerService.getCredentialDefinition(this.agentContext, id)
  }

  public async getRevocationRegistryDefinition(revocationRegistryDefinitionId: string) {
    return this.ledgerService.getRevocationRegistryDefinition(this.agentContext, revocationRegistryDefinitionId)
  }

  public async getRevocationRegistryDelta(
    revocationRegistryDefinitionId: string,
    fromSeconds = 0,
    toSeconds = new Date().getTime()
  ) {
    return this.ledgerService.getRevocationRegistryDelta(
      this.agentContext,
      revocationRegistryDefinitionId,
      fromSeconds,
      toSeconds
    )
  }
}
