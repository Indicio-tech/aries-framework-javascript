import { inject, scoped, Lifecycle } from 'tsyringe'
import { Repository } from "../../../storage/Repository";
import { GenericDataRecord } from "./GenericDataRecord";

import { StorageService } from '../../../storage/StorageService'
import { Symbols } from '../../../symbols'


@scoped(Lifecycle.ContainerScoped)
export class GenericDataRepository extends Repository<GenericDataRecord> {
    public constructor(@inject(Symbols.StorageService) storageService: StorageService<GenericDataRecord>) {
        super(GenericDataRecord, storageService)
    }
}