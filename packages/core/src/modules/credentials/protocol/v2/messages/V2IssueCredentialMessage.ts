import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { Supplements } from '../../../../../decorators/supplements/Supplements'
import { SupplementDecorated } from '../../../../../decorators/supplements/SupplementsExtension'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { CredentialFormatSpec } from '../../../models'

export interface V2IssueCredentialMessageProps {
  id?: string
  comment?: string
  formats: CredentialFormatSpec[]
  credentialAttachments: Attachment[]
  credentialSupplements?: Supplements[]
  supplementsAttachments?: Attachment[]
}
const supplmentedMessage = SupplementDecorated(AgentMessage)

export class V2IssueCredentialMessage extends supplmentedMessage {
  public constructor(options: V2IssueCredentialMessageProps) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.credentialAttachments = options.credentialAttachments
      this.credentialSupplements = options.credentialSupplements ?? []
      this.supplementAttachments = options.supplementsAttachments ?? []
    }
  }
  @Type(() => CredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  @IsInstance(CredentialFormatSpec, { each: true })
  public formats!: CredentialFormatSpec[]

  @IsValidMessageType(V2IssueCredentialMessage.type)
  public readonly type = V2IssueCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/issue-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credentials~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public credentialAttachments!: Attachment[]

  @Expose({ name: 'supplements' })
  @Type(() => Supplements)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Supplements, { each: true })
  public credentialSupplements!: Supplements[]

  @Expose({ name: '~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public supplementAttachments!: Attachment[]

  public getCredentialAttachmentById(id: string): Attachment | undefined {
    return this.credentialAttachments.find((attachment) => attachment.id == id)
  }
}
