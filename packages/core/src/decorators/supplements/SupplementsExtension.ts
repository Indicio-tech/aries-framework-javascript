import type { BaseMessageConstructor } from '../../agent/BaseMessage'

import { Expose, Type } from 'class-transformer'
import { IsInstance, ValidateNested } from 'class-validator'

import { Supplements } from './Supplements'

export function SupplementDecorated<T extends BaseMessageConstructor>(Base: T) {
  class SupplementDecoratorExtension extends Base {
    /**
     * The supplements decorator is required for associating attachments to credentials
     */
    @Expose({ name: 'supplements' })
    @Type(() => Supplements)
    @ValidateNested()
    @IsInstance(Supplements, { each: true })
    public appendedSupplements?: Supplements[]

    public addAppendedSupplements(supplement: Supplements): void {
      if (this.appendedSupplements) {
        this.appendedSupplements.push(supplement)
      } else {
        this.appendedSupplements = [supplement]
      }
    }
  }

  return SupplementDecoratorExtension
}
