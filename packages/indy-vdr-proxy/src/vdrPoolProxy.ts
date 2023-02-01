import type { AgentDependencies } from '@aries-framework/core'
import type { Logger } from '@aries-framework/core/src/logger'
import type { DidIndyNamespace } from '@aries-framework/core/src/utils'
import type { default as Indy } from 'indy-sdk'
import type fetch from 'node-fetch'
import type { Response } from 'node-fetch'

import { LedgerError } from '@aries-framework/core/src/modules/ledger/error'

import { isLedgerRejectResponse, isLedgerReqnackResponse } from '../../indy-sdk/src/ledger/util'

export interface VdrPoolConfig {
  id: string
  url: string
  isProduction: boolean
  indyNamespace: DidIndyNamespace
}

export class vdrPoolProxy {
  private poolConfig: VdrPoolConfig
  private indy: typeof Indy
  private fetch: typeof fetch
  private logger: Logger
  public constructor(agentDependencies: AgentDependencies, logger: Logger, poolConfig: VdrPoolConfig) {
    this.indy = agentDependencies.indy
    this.fetch = agentDependencies.fetch
    this.logger = logger
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

export interface PublicDidRequestVDR {
  did: Indy.GetNymResponse
  pool: vdrPoolProxy
  response: Indy.LedgerReadReplyResponse
}
