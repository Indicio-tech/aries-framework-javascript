import type { AgentDependencies } from '../../../agent/AgentDependencies'
import type { Logger } from '../../../logger'
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

  private fetch: typeof fetch
  private logger: Logger
  public constructor(agentDependencies: AgentDependencies, poolConfig: VdrPoolConfig, logger: Logger) {
    this.fetch = agentDependencies.fetch
    this.poolConfig = poolConfig
    this.logger = logger
  }

  public get id() {
    return this.poolConfig.id
  }

  public get url() {
    return this.poolConfig.url
  }

  public get config(): VdrPoolConfig {
    return this.poolConfig
  }

  public get didIndyNamespace(): string {
    return this.poolConfig.indyNamespace
  }

  public async submitRequest(request: Indy.LedgerRequest): Promise<Indy.LedgerResponse> {
    this.logger.trace(`Sending request to ${this.poolConfig.url}`, request)
    const response: Response = await this.fetch(this.poolConfig.url + '/submit', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    this.logger.trace(`Got response from ${this.poolConfig.url}`, response)
    const text = await response.text()
    this.logger.trace('the text is ' + text)
    return JSON.parse(text) as Indy.LedgerResponse
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
