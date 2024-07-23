import type { AckMessageOptions } from '../../common/messages/AckMessage'

import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'
import { AckMessage } from '../../common/messages/AckMessage'

export type DidRotateAckMessageOptions = AckMessageOptions

export class DidRotateAckMessage extends AckMessage {
  /**
   * Create new CredentialAckMessage instance.
   * @param options
   */
  public constructor(options: DidRotateAckMessageOptions) {
    super(options)
  }

  @IsValidMessageType(DidRotateAckMessage.type)
  public readonly type = DidRotateAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/did-rotate/1.0/ack')
}
