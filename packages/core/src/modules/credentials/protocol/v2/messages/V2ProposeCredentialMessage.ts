import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../../../agent/AgentMessage'
import { Attachment } from '../../../../../decorators/attachment/Attachment'
import { Supplements } from '../../../../../decorators/supplements/Supplements'
import { SupplementDecorated } from '../../../../../decorators/supplements/SupplementsExtension'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { CredentialFormatSpec } from '../../../models'

import { V2CredentialPreview } from './V2CredentialPreview'

export interface V2ProposeCredentialMessageProps {
  id?: string
  formats: CredentialFormatSpec[]
  proposalAttachments: Attachment[]
  proposalSupplements?: Supplements[]
  supplementAttachments?: Attachment[]
  comment?: string
  credentialPreview?: V2CredentialPreview
  attachments?: Attachment[]
}
const supplementedMessage = SupplementDecorated(AgentMessage)

export class V2ProposeCredentialMessage extends supplementedMessage {
  public constructor(props: V2ProposeCredentialMessageProps) {
    super()
    if (props) {
      this.id = props.id ?? this.generateId()
      this.comment = props.comment
      this.credentialPreview = props.credentialPreview
      this.formats = props.formats
      this.proposalAttachments = props.proposalAttachments
      this.appendedAttachments = props.attachments
      this.proposeSupplements = props.proposalSupplements ?? []
      this.supplementAttachments = props.supplementAttachments ?? []
    }
  }

  @Type(() => CredentialFormatSpec)
  @ValidateNested()
  @IsArray()
  public formats!: CredentialFormatSpec[]

  @IsValidMessageType(V2ProposeCredentialMessage.type)
  public readonly type = V2ProposeCredentialMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/propose-credential')

  @Expose({ name: 'credential_preview' })
  @Type(() => V2CredentialPreview)
  @ValidateNested()
  @IsOptional()
  @IsInstance(V2CredentialPreview)
  public credentialPreview?: V2CredentialPreview

  @Expose({ name: 'filters~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  public proposalAttachments!: Attachment[]

  @Expose({ name: 'supplements' })
  @Type(() => Supplements)
  @ValidateNested({
    each: true,
  })
  @IsInstance(Supplements, { each: true })
  @IsOptional()
  public proposeSupplements!: Supplements[]

  @Expose({ name: '~attach' })
  @Type(() => Attachment)
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  @IsOptional()
  public supplementAttachments!: Attachment[]

  /**
   * Human readable information about this Credential Proposal,
   * so the proposal can be evaluated by human judgment.
   */
  @IsOptional()
  @IsString()
  public comment?: string

  public getProposalAttachmentById(id: string): Attachment | undefined {
    return this.proposalAttachments.find((attachment) => attachment.id == id)
  }
}
