import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { uuid } from '../../utils/uuid'

import { SupplementTypes } from './SupplementsTypes'

export interface SupplementOptions {
  id?: string
  type: SupplementTypes
  ref: string
  attrs?: [{ key: string; value: string }]
}

export class Supplements {
  public constructor(options: SupplementOptions) {
    if (options) {
      this.id = options.id ?? uuid()
      this.type = options.type
      this.ref = options.ref
      this.attrs = options.attrs
    }
  }
  @Expose({ name: '@id' })
  public id!: string

  @Expose({ name: 'type' })
  public type!: SupplementTypes

  @Expose({ name: 'ref' })
  @IsString()
  public ref!: string

  @IsOptional()
  public attrs?: [{ key: string; value: string }]
}
