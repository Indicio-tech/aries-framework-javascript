import { ConnectionRecord } from '../modules/connections';
import { AgentMessage } from './AgentMessage';
import { OutboundMessage } from '../types';
import { ConnectionInvitationMessage } from '../modules/connections';
import { IndyAgentService } from '../modules/connections';

export function createOutboundMessage<T extends AgentMessage = AgentMessage>(
  connection: ConnectionRecord,
  payload: T,
  invitation?: ConnectionInvitationMessage
): OutboundMessage<T> {
  if (invitation) {
    // TODO: invitation recipientKeys, routingKeys, endpoint could be missing
    // When invitation uses DID
    return {
      connection,
      endpoint: invitation.serviceEndpoint!,
      payload,
      recipientKeys: invitation.recipientKeys || [],
      routingKeys: invitation.routingKeys || [],
      senderVk: connection.verkey,
    };
  }

  const { theirDidDoc } = connection;

  if (!theirDidDoc) {
    throw new Error(`DidDoc for connection with verkey ${connection.verkey} not found!`);
  }

  const services = theirDidDoc.getServicesByClassType(IndyAgentService);
  let service = services[0]
  for (var i = 0; i < services.length; i++) {
    let potentialService = services[i]
    let potentialServiceTransport = new URL(potentialService.serviceEndpoint)

    if (potentialService.priority < service.priority) {
      service = potentialService
    } else if (
      potentialService.priority === service.priority &&
      (potentialServiceTransport.protocol === 'ws:' ||
        potentialServiceTransport.protocol === 'wss:')
    ) {
      service = potentialService
    }
  }

  return {
    connection,
    endpoint: service.serviceEndpoint,
    payload,
    recipientKeys: service.recipientKeys,
    routingKeys: service.routingKeys ?? [],
    senderVk: connection.verkey,
  };
}
