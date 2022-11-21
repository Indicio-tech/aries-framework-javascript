import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { Supplements } from '../../../../../decorators/supplements/Supplements'
import { SupplementDecorated } from '../../../../../decorators/supplements/SupplementsExtension'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { CredentialFormatSpec } from '../../../models'

export interface V2RequestCredentialMessageOptions {
  id?: string
  formats: CredentialFormatSpec[]
  requestAttachments: Attachment[]
  requestSupplements?: Supplements[]
  supplementsAttachments?: Attachment[]
  comment?: string
}

const supplementedMessage = SupplementDecorated(AgentMessage)

export class V2RequestCredentialMessage extends supplementedMessage {
  public constructor(options: V2RequestCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.requestAttachments = options.requestAttachments
      this.requestSupplements = options.requestSupplements ?? []
      this.supplementAttachments = options.supplementsAttachments ?? []
    }
  }

  @Type(() => CredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  @IsInstance(CredentialFormatSpec, { each: true })
  public formats!: CredentialFormatSpec[]

  @IsValidMessageType(V2RequestCredentialMessage.type)
  public readonly type = V2RequestCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/request-credential')

  @Expose({ name: 'requests~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public requestAttachments!: Attachment[]

  @Expose({ name: 'supplements' })
  @Type(() => Supplements)
  @ValidateNested({
    each: true,
  })
  @IsInstance(Supplements, { each: true })
  @IsOptional()
  public requestSupplements!: Supplements[]

  @Expose({ name: '~attach' })
  @Type(() => Attachment)
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  @IsOptional()
  public supplementAttachments!: Attachment[]

  /**
   * Human readable information about this Credential Request,
   * so the proposal can be evaluated by human judgment.
   */
  @IsOptional()
  @IsString()
  public comment?: string

  public getRequestAttachmentById(id: string): Attachment | undefined {
    return this.requestAttachments.find((attachment) => attachment.id == id)
  }
}
