import { inject, scoped, Lifecycle } from 'tsyringe';
import {Wallet} from '../../../wallet/Wallet'
import { Symbols } from '../../../symbols'
import { GenericDataRepository } from '../repository/GenericDataRepository';
import { GenericDataRecord } from '../repository/GenericDataRecord';
import { Tags } from '../../../storage/BaseRecord';

@scoped(Lifecycle.ContainerScoped)
export class DataStorageService{
    private wallet: Wallet
    private genericDataRepository: GenericDataRepository

    public constructor(
        @inject(Symbols.Wallet) wallet: Wallet,
        genericDataRepository: GenericDataRepository
    ) {
        this.wallet = wallet
        this.genericDataRepository = genericDataRepository
    }

    /**
     * Create a new generic data record
     * 
     * @param value The value to be saved
     * @param mimeType the MIME type string
     * 
     * @returns a new generic data record
     */
    public async addGenericData(
        key: string,
        value:any,
        mimeType: string,
        tags?:Tags
    ): Promise<GenericDataRecord>{
        const genericDataRecord = new GenericDataRecord({
            key,
            value, 
            mimeType,
            tags
        })

        await this.genericDataRepository.save(genericDataRecord)
        return genericDataRecord
    }

    /**
     * Update a generic data record value
     * 
     * @param genericDataRecord The generic data record to be updated
     * @param value The new value for the generic data record
     * 
     * @return The updated generic data record
     */
    public async updateGenericData(genericDataRecord: GenericDataRecord):Promise<GenericDataRecord>{
        await this.genericDataRepository.update(genericDataRecord)
        return genericDataRecord
    }


    /**
     * Delete a generic data record
     * 
     * @param genericDataRecord The generic data record to be deleted
     * 
     * @return void
     */
    public async deleteGenericData(genericDataRecord: GenericDataRecord):Promise<void>{
        await this.genericDataRepository.delete(genericDataRecord)
    }


    /**
     * Get a generic data record by the dataId
     * 
     * @param dataId The ID of the generic data record
     * 
     * @return A generic data record with a matching ID
     */
    public async getGenericDataById(key: string):Promise<GenericDataRecord>{
        return this.genericDataRepository.getById(key)
    }

    /**
     * Get all generic data records
     * 
     * @returns List of all generic data records
     */
    public async getAllGenericData():Promise<GenericDataRecord[]>{
        return this.genericDataRepository.getAll()
    }

    /**
     * Find all records by key.
     * 
     * @param key The key associated with the generic data record(s)
     */
    public async queryByTags(tags:Tags):Promise<GenericDataRecord[]>{
        return this.genericDataRepository.findByQuery(tags)
    }

    /**
     * Find a single record by the key. returns null if not found
     * 
     * @param key The key associated with the generic data record
     * @throws {RecordDuplicateError} if multiple records are found for the given query
     */
    public async querySingleByTags(tags:Tags):Promise<GenericDataRecord | null>{
        return this.genericDataRepository.findSingleByQuery(tags)
    }
}
