import type { DidDoc } from '../modules/connections/models'
import type { ConnectionRecord } from '../modules/connections/repository'
import type { IndyAgentService } from '../modules/dids/domain/service'
import type { OutOfBandRecord } from '../modules/oob/repository'
import type { EncryptedMessage } from '../types'
import type { AgentMessage } from './AgentMessage'
import type { EnvelopeKeys } from './EnvelopeService'

import { Lifecycle, scoped } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE } from '../constants'
import { AriesFrameworkError } from '../error'
import { ConnectionRole, DidExchangeRole } from '../modules/connections/models'
import { DidResolverService } from '../modules/dids'
import { DidCommService } from '../modules/dids/domain/service'

@scoped(Lifecycle.ContainerScoped)
export class TransportService {
  private didResolverService: DidResolverService
  public transportSessionTable: TransportSessionTable = {}

  public constructor(didResolverService: DidResolverService) {
    this.didResolverService = didResolverService
  }

  public saveSession(session: TransportSession) {
    this.transportSessionTable[session.id] = session
  }

  public findSessionByConnectionId(connectionId: string) {
    return Object.values(this.transportSessionTable).find((session) => session.connection?.id === connectionId)
  }

  public findSessionByOutOfBandId(outOfBandId: string) {
    return Object.values(this.transportSessionTable).find((session) => session.outOfBand?.id === outOfBandId)
  }

  public hasInboundEndpoint(didDoc: DidDoc): boolean {
    return Boolean(didDoc.didCommServices.find((s) => s.serviceEndpoint !== DID_COMM_TRANSPORT_QUEUE))
  }

  public findSessionById(sessionId: string) {
    return this.transportSessionTable[sessionId]
  }

  public removeSession(session: TransportSession) {
    delete this.transportSessionTable[session.id]
  }

  public async findDidCommServices(
    connection: ConnectionRecord,
    outOfBandRecord?: OutOfBandRecord
  ): Promise<Array<DidCommService | IndyAgentService>> {
    // Return DIDDoc stored in the connectionRecord
    if (connection.theirDidDoc) {
      return connection.theirDidDoc.didCommServices
    }

    //Return service from legacy connections invitation (connections v1)
    if (connection.role === ConnectionRole.Invitee && connection.invitation) {
      const { invitation } = connection
      if (invitation.serviceEndpoint) {
        const service = new DidCommService({
          id: `${connection.id}-invitation`,
          serviceEndpoint: invitation.serviceEndpoint,
          recipientKeys: invitation.recipientKeys || [],
          routingKeys: invitation.routingKeys || [],
        })
        return [service]
      }
    }

    // Return service(s) from out of band invitation
    // TODO: Abstract into separate helper class/method somewhere?
    if (
      (connection.role === ConnectionRole.Invitee || connection.role === DidExchangeRole.Requester) &&
      outOfBandRecord
    ) {
      let didCommServices: Array<DidCommService | IndyAgentService> = []
      // Iterate through the out of band invitation services
      for (const service of outOfBandRecord.outOfBandMessage.services) {
        // Resolve dids to DIDDocs to retrieve services
        if (typeof service === 'string') {
          const {
            didDocument,
            didResolutionMetadata: { error, message },
          } = await this.didResolverService.resolve(service)

          if (!didDocument) {
            throw new AriesFrameworkError(`Unable to resolve did document for did '${service}': ${error} ${message}`)
          }

          didCommServices = [...didCommServices, ...didDocument.didCommServices]
        }
        // Inline service blocks can just be pushed
        else {
          didCommServices.push(service)
        }
      }
      return didCommServices
    }

    return []
  }
}

interface TransportSessionTable {
  [sessionId: string]: TransportSession
}

export interface TransportSession {
  id: string
  type: string
  keys?: EnvelopeKeys
  inboundMessage?: AgentMessage
  connection?: ConnectionRecord
  outOfBand?: OutOfBandRecord
  send(encryptedMessage: EncryptedMessage): Promise<void>
}
