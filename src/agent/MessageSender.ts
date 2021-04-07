import { OutboundMessage, OutboundPackage } from '../types';
import { OutboundTransporter } from '../transport/OutboundTransporter';
import { EnvelopeService } from './EnvelopeService';
import { ReturnRouteTypes } from '../decorators/transport/TransportDecorator';
import { AgentMessage } from './AgentMessage';
import { Constructor } from '../utils/mixins';
import { InboundMessageContext } from './models/InboundMessageContext';
import { JsonTransformer } from '../utils/JsonTransformer';
import { HttpTransport, TransportService } from './TransportService';
import { Logger } from '../logger';
import { AgentConfig } from './AgentConfig';

class MessageSender {
  private config: AgentConfig;
  private envelopeService: EnvelopeService;
  private transportService: TransportService;
  private logger: Logger;

  public constructor(
    envelopeService: EnvelopeService,
    transportService: TransportService,
    config: AgentConfig,
  ) {
    this.config = config
    this.envelopeService = envelopeService;
    this.transportService = transportService;
    this.logger = this.config.logger;
  }

  public async packMessage(outboundMessage: OutboundMessage): Promise<OutboundPackage> {
    return this.envelopeService.packMessage(outboundMessage);
  }

  public async sendMessage(outboundMessage: OutboundMessage): Promise<void> {
    const outboundPackage = await this.envelopeService.packMessage(outboundMessage);
    this.logger.debug("Sending Message, outboundMessage:", outboundMessage);

    let transport = this.transportService.getTransport(outboundPackage.endpoint)

    await transport.sendMessage(outboundPackage);
  }

  // public async sendAndReceiveMessage<T extends AgentMessage>(
  //   outboundMessage: OutboundMessage,
  //   ReceivedMessageClass: Constructor<T>
  // ): Promise<InboundMessageContext<T>> {
  //   outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all);

  //   const outboundPackage = await this.envelopeService.packMessage(outboundMessage);
  //   const transport = this.transportService.getTransport(outboundMessage.connection.id);
  //   if (transport) {
  //     outboundPackage.transport = transport;
  //   } else {
  //     outboundPackage.transport = new HttpTransport(outboundMessage.endpoint);
  //   }
  //   const inboundPackedMessage = await this.transportService.sendMessage(outboundPackage, true);
  //   const inboundUnpackedMessage = await this.envelopeService.unpackMessage(inboundPackedMessage);

  //   const message = JsonTransformer.fromJSON(inboundUnpackedMessage.message, ReceivedMessageClass);

  //   const messageContext = new InboundMessageContext(message, {
  //     connection: outboundMessage.connection,
  //     recipientVerkey: inboundUnpackedMessage.recipient_verkey,
  //     senderVerkey: inboundUnpackedMessage.sender_verkey,
  //   });

  //   return messageContext;
  // }
}

export { MessageSender };
