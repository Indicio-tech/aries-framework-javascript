import type { AcceptanceMechanisms, AuthorAgreement, TransactionAuthorAgreement } from '../pool'
import type { AgentContext, AgentDependencies, Key } from '@aries-framework/core'
import type { GetNymResponse, IndyVdrRequest, RequestResponseType } from '@hyperledger/indy-vdr-shared'
import type fetch from 'node-fetch'
import type { Response } from 'node-fetch'

import { parseIndyDid } from '@aries-framework/anoncreds'
import { TypedArrayEncoder } from '@aries-framework/core'
import {
  GetAcceptanceMechanismsRequest,
  GetTransactionAuthorAgreementRequest,
  indyVdr,
} from '@hyperledger/indy-vdr-shared'

import { IndyVdrError } from '../error'

export interface VdrPoolConfig {
  id: string
  url: string
  isProduction: boolean
  indyNamespace: string
  transactionAuthorAgreement?: TransactionAuthorAgreement
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
  public authorAgreement?: AuthorAgreement | null
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

  public get indyNamespace(): string {
    return this.config.indyNamespace
  }

  public async submitRequest<Request extends IndyVdrRequest>(request: Request): Promise<RequestResponseType<Request>> {
    const response: Response = await this.fetch(this.poolConfig.url + '/submit', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request.body),
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

  public async prepareWriteRequest<Request extends IndyVdrRequest>(
    agentContext: AgentContext,
    request: Request,
    signingKey: Key,
    endorserDid?: string
  ) {
    await this.appendTaa(request)

    if (endorserDid) {
      request.setEndorser({ endorser: parseIndyDid(endorserDid).namespaceIdentifier })
    }

    const signature = await agentContext.wallet.sign({
      data: TypedArrayEncoder.fromString(request.signatureInput),
      key: signingKey,
    })

    request.setSignature({ signature })

    return request
  }

  private async appendTaa(request: IndyVdrRequest) {
    const authorAgreement = await this.getTransactionAuthorAgreement()
    const poolTaa = this.config.transactionAuthorAgreement

    // If ledger does not have TAA, we can just send a request
    if (authorAgreement == null) {
      return request
    }

    if (!poolTaa) {
      throw new IndyVdrError(
        `Please, specify a transaction author agreement with version and acceptance mechanism. ${JSON.stringify(
          authorAgreement
        )}`
      )
    }

    // Throw an error if the pool doesn't have the specified version and acceptance mechanism
    if (
      authorAgreement.version !== poolTaa.version ||
      !authorAgreement.acceptanceMechanisms.aml[poolTaa.acceptanceMechanism]
    ) {
      // Throw an error with a helpful message
      const errMessage = `Unable to satisfy matching TAA with mechanism ${JSON.stringify(
        poolTaa.acceptanceMechanism
      )} and version ${poolTaa.version} in pool.\n Found ${JSON.stringify(
        authorAgreement.acceptanceMechanisms.aml
      )} and version ${authorAgreement.version} in pool.`
      throw new IndyVdrError(errMessage)
    }

    const acceptance = indyVdr.prepareTxnAuthorAgreementAcceptance({
      text: authorAgreement.text,
      version: authorAgreement.version,
      taaDigest: authorAgreement.digest,
      time: Math.floor(new Date().getTime() / 1000),
      acceptanceMechanismType: poolTaa.acceptanceMechanism,
    })

    request.setTransactionAuthorAgreementAcceptance({
      acceptance: JSON.parse(acceptance),
    })
  }

  private async getTransactionAuthorAgreement(): Promise<AuthorAgreement | null> {
    // TODO Replace this condition with memoization
    if (this.authorAgreement !== undefined) {
      return this.authorAgreement
    }

    const taaRequest = new GetTransactionAuthorAgreementRequest({})
    const taaResponse = await this.submitRequest(taaRequest)

    const acceptanceMechanismRequest = new GetAcceptanceMechanismsRequest({})
    const acceptanceMechanismResponse = await this.submitRequest(acceptanceMechanismRequest)

    const taaData = taaResponse.result.data

    // TAA can be null
    if (taaData == null) {
      this.authorAgreement = null
      return null
    }

    // If TAA is not null, we can be sure AcceptanceMechanisms is also not null
    const authorAgreement = taaData as Omit<AuthorAgreement, 'acceptanceMechanisms'>

    const acceptanceMechanisms = acceptanceMechanismResponse.result.data as AcceptanceMechanisms
    this.authorAgreement = {
      ...authorAgreement,
      acceptanceMechanisms,
    }

    return this.authorAgreement
  }
}

export interface PublicDidRequestVDR {
  did: CachedDidResponse
  pool: VdrPoolProxy
  response: GetNymResponse
}
