import { Equals, IsDate, IsString } from 'class-validator'
import { Expose, Transform, Type } from 'class-transformer'

import { DateTime } from 'luxon'

import { AgentMessage } from '../../../agent/AgentMessage'
import { MessageType } from './BasicMessageMessageType'

export class BasicMessage extends AgentMessage {
  /**
   * Create new BasicMessage instance.
   * sentTime will be assigned to new Date if not passed, id will be assigned to uuid/v4 if not passed
   * @param options
   */
  public constructor(options: { content: string; sentTime?: Date; id?: string; locale?: string }) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.sentTime = options.sentTime || new Date()
      this.content = options.content
      this.addLocale(options.locale || 'en')
    }
  }

  @Equals(BasicMessage.type)
  public readonly type = BasicMessage.type
  public static readonly type = MessageType.BasicMessage

  @Expose({ name: 'sent_time' })
  @Transform(({ value }) => {
    const parsedDate = new Date(value)
    const luxonDate = DateTime.fromSQL(value)
    if (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
      return parsedDate
    }
    if (luxonDate.isValid) {
      return new Date(luxonDate.toString())
    }
    return new Date()
  })
  @IsDate()
  public sentTime!: Date

  @Expose({ name: 'content' })
  @IsString()
  public content!: string
}
