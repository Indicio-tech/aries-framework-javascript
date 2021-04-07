import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { Attachment } from '../../../decorators/attachment/Attachment'
import { DataTransferMessageType } from './DataTransferMessageType'

export interface DataTransferProvideDataMessageOptions {
  id?: string
  goal_code: string
  attachments: Attachment[]
}

/**
 * Send Data
 *
 * @see https://hackmd.io/2toAWkUIS1CSY_KYpW25Yw
 */
export class DataTransferProvideDataMessage extends AgentMessage {
  /**
   * Create new DataTransferProvideDataMessage instance.
   * @param options
   */
  public constructor(options: DataTransferProvideDataMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.goal_code = options.goal_code
      this.attachments = options.attachments
    }
  }

  @Equals(DataTransferProvideDataMessage.type)
  public readonly type = DataTransferProvideDataMessage.type
  public static readonly type = DataTransferMessageType.ProvideData

  @IsString()
  public goal_code!: string

  /**
   * An array of attachments containing data.
   */
  @Expose({ name: 'data~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  public attachments!: Attachment[]
}
