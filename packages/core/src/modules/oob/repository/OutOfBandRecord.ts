import type { TagsBase } from '../../../storage/BaseRecord'
import type { DidCommService } from '../../dids'
import type { OutOfBandRole } from '../domain/OutOfBandRole'
import type { OutOfBandState } from '../domain/OutOfBandState'

import { Transform } from 'class-transformer'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { V1OutOfBandMessage, V1_1OutOfBandMessage } from '../messages'

export interface OutOfBandRecordProps {
  id?: string
  createdAt?: Date
  updatedAt?: Date
  tags?: TagsBase
  outOfBandMessage: V1OutOfBandMessage | V1_1OutOfBandMessage
  role: OutOfBandRole
  state: OutOfBandState
  autoAcceptConnection?: boolean
  reusable?: boolean
}

export class OutOfBandRecord extends BaseRecord<TagsBase> {
  @Transform(({ value }) => {
    if (value.type === V1OutOfBandMessage.type) {
      return new V1OutOfBandMessage(value)
    } else {
      return new V1_1OutOfBandMessage(value)
    }
  })
  public outOfBandMessage!: V1OutOfBandMessage | V1_1OutOfBandMessage
  public role!: OutOfBandRole
  public state!: OutOfBandState
  public reusable!: boolean
  public autoAcceptConnection?: boolean

  public static readonly type = 'OutOfBandRecord'
  public readonly type = OutOfBandRecord.type

  public constructor(props: OutOfBandRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.outOfBandMessage = props.outOfBandMessage
      this.role = props.role
      this.state = props.state
      this.autoAcceptConnection = props.autoAcceptConnection
      this.reusable = props.reusable ?? false
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    const [recipientKey] = this.getRecipientKeys()

    return {
      ...this._tags,
      role: this.role,
      state: this.state,
      messageId: this.outOfBandMessage.id,
      recipientKey,
    }
  }

  public getRecipientKeys() {
    return this.outOfBandMessage.services
      .filter((s): s is DidCommService => typeof s !== 'string')
      .map((s) => s.recipientKeys)
      .reduce((acc, curr) => [...acc, ...curr], [])
  }

  public assertState(expectedStates: OutOfBandState | OutOfBandState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new AriesFrameworkError(
        `OutOfBand record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }
}
