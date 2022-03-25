import { Transform } from 'class-transformer'
import { Equals } from 'class-validator'
import { replaceLegacyDidSovPrefix } from '../../../utils/messageType'

import { AgentMessage } from '../../../agent/AgentMessage'

export interface HandshakeReuseAcceptedMessageOptions {
  id?: string
  parentThreadId?: string
}

export class V1_1HandshakeReuseAcceptedMessage extends AgentMessage {
  public constructor(options: HandshakeReuseAcceptedMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.setThread({
        threadId: this.id,
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @Equals(V1_1HandshakeReuseAcceptedMessage.type)
  public readonly type = V1_1HandshakeReuseAcceptedMessage.type
  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  public static readonly type = 'https://didcomm.org/out-of-band/1.1/handshake-reuse-accepted'
}

export class V1HandshakeReuseAcceptedMessage extends AgentMessage {
  public constructor(options: HandshakeReuseAcceptedMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.setThread({
        threadId: this.id,
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @Equals(V1HandshakeReuseAcceptedMessage.type)
  public readonly type = V1HandshakeReuseAcceptedMessage.type
  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  public static readonly type = 'https://didcomm.org/out-of-band/1.0/handshake-reuse-accepted'
}
