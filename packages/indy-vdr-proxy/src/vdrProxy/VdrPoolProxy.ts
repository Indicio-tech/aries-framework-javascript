import type { AgentDependencies } from '@aries-framework/core'
import { GetNymResponse, IndyVdrRequest, RequestResponseType } from '@hyperledger/indy-vdr-shared'
import type { default as Indy, LedgerRejectResponse, LedgerReqnackResponse, LedgerResponse } from 'indy-sdk'
import type fetch from 'node-fetch'
import type { Response } from 'node-fetch'

export interface VdrPoolConfig {
  id: string
  url: string
  isProduction: boolean
  indyNamespace: string
}

export interface CachedDidResponse {
  nymResponse: {
    did: string
    verkey: string
  }
  indyNamespace: string
}

export class VdrPoolProxy {
  private poolConfig: VdrPoolConfig
  private fetch: typeof fetch
  public constructor(agentDependencies: AgentDependencies, poolConfig: VdrPoolConfig) {
    this.fetch = agentDependencies.fetch
    this.poolConfig = poolConfig
  }

  public get id() {
    return this.poolConfig.id
  }

  public get url() {
    return this.poolConfig.url
  }

  public get config(): VdrPoolConfig {
    return this.config
  }

  public get didIndyNamespace(): string {
    return this.config.indyNamespace
  }

  public async submitRequest<Request extends IndyVdrRequest>(request: Request): Promise<RequestResponseType<Request>> {
    const response: Response = await this.fetch(this.poolConfig.url + '/submit', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    return JSON.parse(await response.json())
  }

  public async submitWriteRequest<Request extends IndyVdrRequest>(request: Request) {
    const response = await this.submitRequest(request)

    return response
  }

  public async submitReadRequest<Request extends IndyVdrRequest>(request: Request) {
    const response = await this.submitRequest(request)

    return response
  }
}

function isLedgerRejectResponse(response: LedgerResponse): response is LedgerRejectResponse {
  return response.op === 'REJECT'
}

function isLedgerReqnackResponse(response: LedgerResponse): response is LedgerReqnackResponse {
  return response.op === 'REQNACK'
}

export interface PublicDidRequestVDR {
  did: CachedDidResponse
  pool: VdrPoolProxy
  response: GetNymResponse
}
