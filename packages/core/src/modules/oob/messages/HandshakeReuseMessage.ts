import { Transform } from 'class-transformer'
import { Equals } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { replaceLegacyDidSovPrefix } from '../../../utils/messageType'

export interface HandshakeReuseMessageOptions {
  id?: string
  parentThreadId?: string
}

export class V1_1HandshakeReuseMessage extends AgentMessage {
  public constructor(options: HandshakeReuseMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.setThread({
        threadId: this.id,
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @Equals(V1_1HandshakeReuseMessage.type)
  public readonly type = V1_1HandshakeReuseMessage.type
  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  public static readonly type = 'https://didcomm.org/out-of-band/1.1/handshake-reuse'
}

export class V1HandshakeReuseMessage extends AgentMessage {
  public constructor(options: HandshakeReuseMessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.setThread({
        threadId: this.id,
        parentThreadId: options.parentThreadId,
      })
    }
  }

  @Equals(V1HandshakeReuseMessage.type)
  public readonly type = V1HandshakeReuseMessage.type
  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  public static readonly type = 'https://didcomm.org/out-of-band/1.0/handshake-reuse'
}
