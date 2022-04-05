import type { Handler } from '../../../agent/Handler'
import type { Logger } from '../../../logger'

import { V1HandshakeReuseMessage, V1_1HandshakeReuseMessage } from '../messages/HandshakeReuseMessage'

export class HandshakeReuseHandler implements Handler {
  public supportedMessages = [V1HandshakeReuseMessage, V1_1HandshakeReuseMessage]
  private logger: Logger

  public constructor(logger: Logger) {
    this.logger = logger
  }

  public async handle() {
    this.logger.error(`Out of band ${V1HandshakeReuseMessage.type} message not implemented yet.`)
  }
}
