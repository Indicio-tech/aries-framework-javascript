import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { Logger } from '../../../logger'

import { V1HandshakeReuseAcceptedMessage, V1_1HandshakeReuseAcceptedMessage } from '../messages/HandshakeReuseAcceptedMessage'
import { OutOfBandService } from '../OutOfBandService'

export class HandshakeReuseAcceptedHandler implements Handler {
  private outOfBandService: OutOfBandService
  public supportedMessages = [V1HandshakeReuseAcceptedMessage, V1_1HandshakeReuseAcceptedMessage]
  private logger: Logger

  public constructor(logger: Logger, outOfBandService: OutOfBandService) {
    this.logger = logger
    this.outOfBandService = outOfBandService
  }

  public async handle(inboundMessage: HandlerInboundMessage<HandshakeReuseAcceptedHandler>) {
    await this.outOfBandService.processReuseAccepted(inboundMessage)
  }
}
