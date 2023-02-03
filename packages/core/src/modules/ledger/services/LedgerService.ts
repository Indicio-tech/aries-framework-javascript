import type { VdrPoolProxy } from './VdrPoolProxy'
import type { AgentContext } from '../../../agent'
import type { IndyPoolConfig } from '../IndyPool'
import type { CredDef, default as Indy, Schema } from 'indy-sdk'

export abstract class LedgerService {
  public abstract setPools(poolsConfigs: IndyPoolConfig[] | VdrPoolProxy[]): void

  public abstract registerSchema(agent: AgentContext, did: string, schemaTemplate: SchemaTemplate): Promise<Schema>

  public abstract getSchema(agentContext: AgentContext, schemaId: string): Promise<Schema>

  public abstract registerCredentialDefinition(
    agentContext: AgentContext,
    did: string,
    createCredentialDefinition: CredentialDefinitionTemplate
  ): Promise<CredDef>

  public abstract getCredentialDefinition(agentContext: AgentContext, credentialDefinitionId: string): Promise<CredDef>

  public abstract getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<ParseRevocationRegistryDefinitionTemplate>

  public abstract getRevocationRegistryDelta(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    to: number,
    from: number
  ): Promise<ParseRevocationRegistryDeltaTemplate>

  public abstract getRevocationRegistry(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string,
    timestamp: number
  ): Promise<ParseRevocationRegistryTemplate>
}

export interface SchemaTemplate {
  name: string
  version: string
  attributes: string[]
}

export interface CredentialDefinitionTemplate {
  schema: Schema
  tag: string
  signatureType: 'CL'
  supportRevocation: boolean
}

export interface ParseRevocationRegistryDefinitionTemplate {
  revocationRegistryDefinition: Indy.RevocRegDef
  revocationRegistryDefinitionTxnTime: number
}

export interface ParseRevocationRegistryDeltaTemplate {
  revocationRegistryDelta: Indy.RevocRegDelta
  deltaTimestamp: number
}

export interface ParseRevocationRegistryTemplate {
  revocationRegistry: Indy.RevocReg
  ledgerTimestamp: number
}

export interface IndyEndpointAttrib {
  endpoint?: string
  types?: Array<'endpoint' | 'did-communication' | 'DIDComm'>
  routingKeys?: string[]
  [key: string]: unknown
}
