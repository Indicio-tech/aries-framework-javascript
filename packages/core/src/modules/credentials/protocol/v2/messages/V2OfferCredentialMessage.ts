import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { Supplements } from '../../../../../decorators/supplements/Supplements'
import { SupplementDecorated } from '../../../../../decorators/supplements/SupplementsExtension'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { CredentialFormatSpec } from '../../../models'

import { V2CredentialPreview } from './V2CredentialPreview'

export interface V2OfferCredentialMessageOptions {
  id?: string
  formats: CredentialFormatSpec[]
  offerAttachments: Attachment[]
  offerSupplements?: Supplements[]
  supplementsAttachments?: Attachment[]
  credentialPreview: V2CredentialPreview
  replacementId?: string
  comment?: string
}

const supplementedMessage = SupplementDecorated(AgentMessage)

export class V2OfferCredentialMessage extends supplementedMessage {
  public constructor(options: V2OfferCredentialMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.comment = options.comment
      this.formats = options.formats
      this.credentialPreview = options.credentialPreview
      this.offerAttachments = options.offerAttachments
      this.offerSupplements = options.offerSupplements ?? []
      this.supplementAttachments = options.supplementsAttachments ?? []
    }
  }

  @Type(() => CredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  @IsInstance(CredentialFormatSpec, { each: true })
  public formats!: CredentialFormatSpec[]

  @IsValidMessageType(V2OfferCredentialMessage.type)
  public readonly type = V2OfferCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/offer-credential')

  @IsString()
  @IsOptional()
  public comment?: string

  @Expose({ name: 'credential_preview' })
  @Type(() => V2CredentialPreview)
  @ValidateNested()
  @IsInstance(V2CredentialPreview)
  public credentialPreview?: V2CredentialPreview

  @Expose({ name: 'offers~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public offerAttachments!: Attachment[]

  @Expose({ name: 'supplements' })
  @Type(() => Supplements)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Supplements, { each: true })
  public offerSupplements!: Supplements[]

  @Expose({ name: '~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public supplementAttachments!: Attachment[]

  @Expose({ name: 'replacement_id' })
  @IsString()
  @IsOptional()
  public replacementId?: string

  public getOfferAttachmentById(id: string): Attachment | undefined {
    return this.offerAttachments.find((attachment) => attachment.id == id)
  }
}
