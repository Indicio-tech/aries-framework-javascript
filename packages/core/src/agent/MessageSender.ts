import type { ConnectionRecord } from '../modules/connections'
import type { OutboundTransporter } from '../transport/OutboundTransporter'
import type { OutboundPackage, WireMessage } from '../types'
import type { EnvelopeKeys } from './EnvelopeService'
import type { TransportSession } from './TransportService'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { DID_COMM_TRANSPORT_QUEUE, InjectionSymbols } from '../constants'
import { DidCommService } from '../modules/connections'
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator'
import { AriesFrameworkError } from '../error'
import { Logger } from '../logger'
import { MessageRepository } from '../storage/MessageRepository'

import { AgentMessage } from './AgentMessage'
import { EnvelopeService } from './EnvelopeService'
import { TransportService } from './TransportService'

export interface TransportPriorityOptions { 
  schemes: string[],
  restrictive?: Boolean
}

@scoped(Lifecycle.ContainerScoped)
export class MessageSender {
  private envelopeService: EnvelopeService
  private transportService: TransportService
  private messageRepository: MessageRepository
  private logger: Logger
  private outboundTransports: OutboundTransporter[] = []

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    @inject(InjectionSymbols.MessageRepository) messageRepository: MessageRepository,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.envelopeService = envelopeService
    this.transportService = transportService
    this.messageRepository = messageRepository
    this.logger = logger
    this.outboundTransports = []
  }

  public registerOutboundTransporter(outboundTransporter: OutboundTransporter) {
    this.outboundTransports.push(outboundTransporter)
  }

  public get outboundTransporters() {
    return this.outboundTransports
  }

  public async packMessage({
    keys,
    message,
    endpoint,
  }: {
    keys: EnvelopeKeys
    message: AgentMessage
    endpoint: string
  }): Promise<OutboundPackage> {
    const wireMessage = await this.envelopeService.packMessage(message, keys)

    return {
      payload: wireMessage,
      responseRequested: message.hasAnyReturnRoute(),
      endpoint,
    }
  }

  private async sendMessageToSession(session: TransportSession, message: AgentMessage) {
    this.logger.debug(`Existing ${session.type} transport session has been found.`, {
      keys: session.keys,
    })
    if (!session.keys) {
      throw new AriesFrameworkError(`There are no keys for the given ${session.type} transport session.`)
    }
    const wireMessage = await this.envelopeService.packMessage(message, session.keys)

    await session.send(wireMessage)
  }

  public async sendPackage({
    connection,
    packedMessage,
    options,
  }: {
    connection: ConnectionRecord
    packedMessage: WireMessage
    options?: { transportPriority?: TransportPriorityOptions }
  }) {
    // Try to send to already open session
    const session = this.transportService.findSessionByConnectionId(connection.id)
    if (session?.inboundMessage?.hasReturnRouting()) {
      try {
        await session.send(packedMessage)
        return
      } catch (error) {
        this.logger.info(`Sending packed message via session failed with error: ${error.message}.`, error)
      }
    }

    // Retrieve DIDComm services
    const { services, queueService } = await this.retrieveServicesByConnection(connection, options?.transportPriority)

    if (this.outboundTransporters.length === 0 && !queueService) {
      throw new AriesFrameworkError('Agent has no outbound transporter!')
    }

    // Loop trough all available services and try to send the message
    for await (const service of services) {
      this.logger.debug(`Sending outbound message to service:`, { service })
      try {
        const protocol = service.serviceEndpoint.split(':')[0]
        for (const transport of this.outboundTransporters) {
          if (transport.supportedSchemes.includes(protocol)) {
            await transport.sendMessage({
              payload: packedMessage,
              endpoint: service.serviceEndpoint,
            })
            break
          }
        }
        return
      } catch (error) {
        this.logger.debug(
          `Sending outbound message to service with id ${service.id} failed with the following error:`,
          {
            message: error.message,
            error: error,
          }
        )
      }
    }

    // We didn't succeed to send the message over open session, or directly to serviceEndpoint
    // If the other party shared a queue service endpoint in their did doc we queue the message
    if (queueService) {
      this.logger.debug(`Queue packed message for connection ${connection.id} (${connection.theirLabel})`)
      this.messageRepository.add(connection.id, packedMessage)
      return
    }

    // Message is undeliverable
    this.logger.error(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`, {
      message: packedMessage,
      connection,
    })
    throw new AriesFrameworkError(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`)
  }


  public async sendMessagey(
    outboundMessage: OutboundMessage, 
    options?: { 
      transportPriority?: TransportPriorityOptions
    }
  ) {
    

    // Try to send to already open session
    const session = this.transportService.findSessionByConnectionId(connection.id)
    if (session?.inboundMessage?.hasReturnRouting(payload.threadId)) {
      try {
        await this.sendMessageToSession(session, payload)
        return
      } catch (error) {
        this.logger.info(`Sending an outbound message via session failed with error: ${error.message}.`, error)
      }
    }

    // Retrieve DIDComm services
    const { services, queueService } = await this.retrieveServicesByConnection(connection, options?.transportPriority)

    // Loop trough all available services and try to send the message
    for await (const service of services) {
      try {
        // Enable return routing if the
        const shouldUseReturnRoute = !this.transportService.hasInboundEndpoint(connection.didDoc)

        await this.sendMessageToService({
          message: payload,
          service,
          senderKey: connection.verkey,
          returnRoute: shouldUseReturnRoute,
        })
        return
      } catch (error) {
        this.logger.debug(
          `Sending outbound message to service with id ${service.id} failed with the following error:`,
          {
            message: error.message,
            error: error,
          }
        )
      }
    }
  }

  //private async sortConnectionServices({connection}){}
  //sorts services for connection

  //Sends a message to a connection
  public async sendMessagex({
    connection,
    message
  }: {
    connection: ConnectionRecord
    message: AgentMessage | WireMessage
  }){
    this.logger.debug(`Going to send outbound message to connection '${connection.id}'`, {messageType: (message instanceof AgentMessage? 'AgentMessage' : 'WireMessage')})
    if(message instanceof AgentMessage){
      message
    } else {
      message
    }
    connection.verkey
  }

  //SenderKey is required if payload is a service AgentMessage
  public async sendMessage({
    message,
    recipient,
    senderKey,
  }: {
    message: AgentMessage | WireMessage
    recipient: DidCommService | ConnectionRecord
    senderKey?: string
  }){
    if(recipient instanceof DidCommService){
    this.logger.debug(`Going to send outbound message`)
    this.logger.debug(`Going to send outbound message to service '${service.id}'`, { service, message})

    let wireMessage:WireMessage
    let returnRoute:boolean = false

    if(message instanceof AgentMessage){
      //Pack Agent Message
      this.logger.debug(`Packing Agent Message into wire message`)
      
      if(!senderKey){
        throw new AriesFrameworkError('A sender key must be given when sending AgentMessages')
      }
    
      const {payload, responseRequested} = await this.packMessage({ 
        message, 
        keys: {
          recipientKeys: service.recipientKeys,
          routingKeys: service.routingKeys || [],
          senderKey,
        }, 
        endpoint: service.serviceEndpoint 
      })
      wireMessage = payload
      returnRoute = responseRequested!

      this.logger.debug('Agent message packed')
    } else {
      wireMessage = message
    }
    
    await this.sendWireMessageToEndpoint({
      endpoint: service.serviceEndpoint,
      wireMessage,
      returnRoute
    })

    // We didn't succeed to send the message over open session, or directly to serviceEndpoint
    // If the other party shared a queue service endpoint in their did doc we queue the message
    if (queue) {
      this.logger.debug(`Queue message for connection ${queue.connection.id}`)

      this.messageRepository.add(queue.connection.id, wireMessage)
      return
    }

    // Message is undeliverable
    this.logger.error(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`, {
      message: payload,
      connection,
    })
    throw new AriesFrameworkError(`Message is undeliverable to connection ${connection.id} (${connection.theirLabel})`)
  }

  private async sendWireMessageToEndpoint({
    endpoint,
    wireMessage,
    returnRoute
  }: {
    endpoint: string
    wireMessage: WireMessage
    returnRoute?: boolean
  }) {
    this.logger.debug(`Sending Wire Message to endpoint '${endpoint}' with return route ${returnRoute ? 'true' : 'false'}`)

    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transporters!')
    }

    const scheme = endpoint.split(':')[0]
    for (const transport of this.outboundTransporters) {
      if (transport.supportedSchemes.includes(scheme)) {
        await transport.sendMessage({
          payload: wireMessage,
          endpoint,
          responseRequested: returnRoute
        })
        return
      }
    }

    throw new AriesFrameworkError(`Agent has no registered transporters for this endpoint '${endpoint}' using transport scheme '${scheme}'!`)
  }
  
  




  // sortConnectionServices({connection})
  // //sorts services for connection
  // sendMessage({service, connection?})
  // //uses sortConnectionServices() if needed
  // sendWireMessage({service, connection?})
  // //uses sortConnectionServices() if needed
  // sendWireMessageToService({service})
  // //sendMessageToService()
  public async sendAgentMessageToService({
    message,
    service,
    senderKey,
    returnRoute,
  }: {
    message: AgentMessage
    service: DidCommService
    senderKey: string
    returnRoute?: boolean
  }) {
    this.logger.debug(`Sending outbound message to service:`, { messageId: message.id, service })

    const keys = {
      recipientKeys: service.recipientKeys,
      routingKeys: service.routingKeys || [],
      senderKey,
    }

    // Set return routing for message if requested
    if (returnRoute) {
      message.setReturnRouting(ReturnRouteTypes.all)
    }

    const outboundPackage:OutboundPackage = await this.packMessage({ message, keys, endpoint: service.serviceEndpoint })
    await this.sendMessageToService(outboundPackage)
  }

  //Sends a message to a given registered agent
  private async sendMessageToServicey({
    message,
    service,
    senderKey,
    returnRoute,
  }: {
    message: AgentMessage
    service: DidCommService
    senderKey: string
    returnRoute?: boolean
  }) {
    if (this.outboundTransports.length === 0) {
      throw new AriesFrameworkError('Agent has no outbound transporters!')
    }

    const scheme = endpoint.split(':')[0]
    for (const transport of this.outboundTransporters) {
      if (transport.supportedSchemes.includes(scheme)) {
        await transport.sendMessage(outboundPackage)
        break
      }
    }
  }

  private async retrieveServicesByConnection(
    connection: ConnectionRecord,
    transportPriority?: TransportPriorityOptions
  ) {
    this.logger.debug(`Retrieving services for connection '${connection.id}'${' (' && connection.theirLabel && ')'}${transportPriority?.restrictive && ' restrictively ', transportPriority && ' by priority of the follow schemes: ' + transportPriority.schemes}`)
    // Retrieve DIDComm services
    const allServices = this.transportService.findDidCommServices(connection)

    //Separate queue service out
    const services = allServices.filter((s) => !isDidCommTransportQueue(s.serviceEndpoint))
    const queueService = allServices.find((s) => isDidCommTransportQueue(s.serviceEndpoint))

    //If restrictive will remove services not listed in schemes list
    if(transportPriority?.restrictive){
      services.filter((service) => {
        const serviceSchema = service.serviceEndpoint.split(':')[0]
        return transportPriority.schemes.includes(serviceSchema)
      })
    }

    //If transport priority is set we will sort services by our priority
    if(transportPriority?.schemes){
      services.sort(function(a, b) {
        const aScheme = a.serviceEndpoint.split(':')[0]
        const bScheme = b.serviceEndpoint.split(':')[0]
        return transportPriority?.schemes.indexOf(aScheme) - transportPriority?.schemes.indexOf(bScheme);
      });
    }

    this.logger.debug(
      `Retrieved ${services.length} services for message to connection '${connection.id}'${' (' && connection.theirLabel && ')'}`
    )
    return { services, queueService }
  }
}

export function isDidCommTransportQueue(serviceEndpoint: string): serviceEndpoint is typeof DID_COMM_TRANSPORT_QUEUE {
  return serviceEndpoint === DID_COMM_TRANSPORT_QUEUE
}
