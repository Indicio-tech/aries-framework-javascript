import { GenericDataRecord } from './repository/GenericDataRecord'
import { scoped, Lifecycle } from 'tsyringe'
import {DataStorageService} from './services'
import { Tags } from '../../storage/BaseRecord'

@scoped(Lifecycle.ContainerScoped)
export class DataStorageModule {
    private dataStorageService: DataStorageService

    public constructor(
        dataStorageService: DataStorageService,
    ){
        this.dataStorageService = dataStorageService
    }


    /**
     * create and save a new generic data record
     * 
     * @param key The key for the record
     * @param value The value to be saved
     * @param mimeType The MIME type string
     * @param tags Optional tags to reference the record by
     * 
     * @returns a new generic data record
     */
    public async addGenericData(
        key: string,
        value:any,
        mimeType: string,
        tags?: Tags
    ): Promise<GenericDataRecord>{
        return this.dataStorageService.addGenericData(key, value, mimeType, tags)
    }


    /**
     * Update a generic data record value
     * 
     * @param genericDataRecord The generic data record to be updated
     * @param value The new value for the generic data record
     * 
     * @return The updated generic data record
     */
    // public async updateGenericData(genericDataRecord: GenericDataRecord, value: any):Promise<GenericDataRecord>{
    //     genericDataRecord.value = value
    //     return this.dataStorageService.updateGenericData(genericDataRecord)
    // }


    /**
     * 
     * @param key The key for the generic data record to be updated
     * @param value The new value for the generic data record
     * 
     * @return The updated generic data record
     */
    public async updateGenericDataByKey(key:string, value:any):Promise<GenericDataRecord>{
        let genericDataRecord = await this.dataStorageService.getGenericDataById(key)
        genericDataRecord.value = value

        return this.dataStorageService.updateGenericData(genericDataRecord)
    }


    /**
     * Delete a generic data record
     * 
     * @param genericDataRecord The generic data record to be deleted
     * 
     * @return void
     */
     public async deleteGenericData(genericDataRecord: GenericDataRecord):Promise<void>{
        await this.dataStorageService.deleteGenericData(genericDataRecord)
    }


    /**
     * Get a generic data record by the key
     * 
     * @param key The ID of the generic data record
     * 
     * @return A generic data record with a matching key
     */
    public async getGenericDataByKey(key: string):Promise<GenericDataRecord>{
        return this.dataStorageService.getGenericDataById(key)
    }


    /**
     * Get all generic data records
     * 
     * @returns List of all generic data records
     */
    public async getAllGenericData():Promise<GenericDataRecord[]>{
        return this.dataStorageService.getAllGenericData()
    }


    /**
     * Query the storage for matching tags
     * 
     * @param tags The tags associated with the generic data record(s)
     * 
     * @returns A list of generic data records
     */
    public async queryByTags(tags: Tags):Promise<GenericDataRecord[]>{
        return this.dataStorageService.queryByTags(tags)
    }

    /**
     * Find a single record by the associated tags. returns null if not found
     * 
     * @param tags The tags associated with the generic data record
     * @throws {RecordDuplicateError} if multiple records are found for the given query
     * 
     * @returns A generic data record
     */
     public async querySingleByTags(tags: Tags):Promise<GenericDataRecord | null>{
        return this.dataStorageService.querySingleByTags(tags)
    }

    /**
     * Checks to see if there is an existing data record with specific key
     * 
     * @param key The key to search for
     * 
     * @return A boolean
     */
    public async checkForKey(key:string):Promise<Boolean>{
        try{
            await this.getGenericDataByKey(key)
            return true
        }catch(err){
            return false
        }
    }


}