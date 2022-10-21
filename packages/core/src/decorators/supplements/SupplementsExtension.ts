import type { BaseMessageConstructor } from '../../agent/BaseMessage'

import { Expose, Type } from 'class-transformer'
import { IsInstance, ValidateNested } from 'class-validator'

import { Supplements } from './Supplements'

export function SupplementDecorated<T extends BaseMessageConstructor>(Base: T) {
  class SupplementDecoratorExtension extends Base {
    @Expose({ name: '~supplements' })
    @Type(() => Supplements)
    @ValidateNested()
    @IsInstance(Supplements, { each: true })
    public appendedSupplments?: Supplements[]

    public addAppenedSupplements(supplement: Supplements): void {
      if (this.appendedSupplments) {
        this.appendedSupplments.push(supplement)
      } else {
        this.appendedSupplments = [supplement]
      }
    }
  }

  return SupplementDecoratorExtension
}
