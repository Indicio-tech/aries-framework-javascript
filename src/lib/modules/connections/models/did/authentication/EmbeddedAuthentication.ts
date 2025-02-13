import { IsNotEmpty, ValidateNested } from 'class-validator';
import { PublicKey } from '../publicKey/PublicKey';
import { Authentication } from './Authentication';

export class EmbeddedAuthentication extends Authentication {
  @IsNotEmpty()
  @ValidateNested()
  public publicKey!: PublicKey;

  public constructor(publicKey: PublicKey) {
    super();

    this.publicKey = publicKey;
  }
}
