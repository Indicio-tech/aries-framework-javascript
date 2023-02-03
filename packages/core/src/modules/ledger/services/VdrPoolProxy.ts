import type { AgentDependencies } from '../../../agent/AgentDependencies'
import type { DidIndyNamespace } from '../../../utils'
import type { default as Indy, LedgerRejectResponse, LedgerReqnackResponse, LedgerResponse } from 'indy-sdk'
import type { Response } from 'node-fetch'
import type fetch from 'node-fetch'

import { LedgerError } from '../error/LedgerError'

export interface VdrPoolConfig {
  id: string
  url: string
  isProduction: boolean
  indyNamespace: DidIndyNamespace
}

export class VdrPoolProxy {
  private poolConfig: VdrPoolConfig
  private indy: typeof Indy
  private fetch: typeof fetch
  public constructor(agentDependencies: AgentDependencies, poolConfig: VdrPoolConfig) {
    this.indy = agentDependencies.indy
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

  public async submitRequest(request: Indy.LedgerRequest): Promise<Indy.LedgerResponse> {
    const response: Response = await this.fetch(this.poolConfig.url + '/submit', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    return JSON.parse(await response.json()) as Indy.LedgerResponse
  }

  public async submitWriteRequest(request: Indy.LedgerRequest) {
    const response = await this.submitRequest(request)

    if (isLedgerRejectResponse(response) || isLedgerReqnackResponse(response)) {
      throw new LedgerError(`Ledger '${this.id}' rejected write transaction request: ${response.reason}`)
    }

    return response as Indy.LedgerWriteReplyResponse
  }

  public async submitReadRequest(request: Indy.LedgerRequest) {
    const response = await this.submitRequest(request)

    if (isLedgerRejectResponse(response) || isLedgerReqnackResponse(response)) {
      throw new LedgerError(`Ledger '${this.id}' rejected read transaction request: ${response.reason}`)
    }

    return response as Indy.LedgerReadReplyResponse
  }
}

function isLedgerRejectResponse(response: LedgerResponse): response is LedgerRejectResponse {
  return response.op === 'REJECT'
}

function isLedgerReqnackResponse(response: LedgerResponse): response is LedgerReqnackResponse {
  return response.op === 'REQNACK'
}

export interface PublicDidRequestVDR {
  did: Indy.GetNymResponse
  pool: VdrPoolProxy
  response: Indy.LedgerReadReplyResponse
}
