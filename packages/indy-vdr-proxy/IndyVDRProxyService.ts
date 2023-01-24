import type { AgentContext } from '../core/src/agent'
import type {
  CredentialDefinitionTemplate,
  ParseRevocationRegistryDefinitionTemplate,
  ParseRevocationRegistryDeltaTemplate,
  ParseRevocationRegistryTemplate,
  SchemaTemplate,
} from '../core/src/modules/ledger/services/LedgerServiceInterface'
import type { CredDef, Schema } from 'indy-sdk'
import type fetch from 'node-fetch'

import { AgentDependencies } from '../core/src/agent/AgentDependencies'
import { InjectionSymbols } from '../core/src/constants'
import { Logger } from '../core/src/logger'
import { LedgerServiceInterface } from '../core/src/modules/ledger/services/LedgerServiceInterface'
import { injectable, inject } from '../core/src/plugins'

@injectable()
export class IndyVDRProxyService extends LedgerServiceInterface {
  private logger: Logger
  private pools: string[]
  private fetch: typeof fetch

  public constructor(
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger,
    pools: string[]
  ) {
    super()
    this.logger = logger
    this.pools = pools
    this.fetch = agentDependencies.fetch
  }

  public setPools(poolsConfigs: string[]): void {
    throw new Error('Method not implemented.')
  }
  public registerSchema(agent: AgentContext, did: string, schemaTemplate: SchemaTemplate): Promise<Schema> {
    throw new Error('Write Request are not supported by the VDR Proxy service.')
  }
  public getSchema(agentContext: AgentContext, schemaId: string): Promise<Schema> {
    throw new Error('Method not implemented.')
  }
  public registerCredentialDefinition(
    agentContext: AgentContext,
    did: string,
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
}
