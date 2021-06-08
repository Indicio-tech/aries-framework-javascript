import { Subject } from 'rxjs'
import { Agent, GenericDataRecord } from '..'
import { Tags } from '../storage/BaseRecord'
import { 
    getBaseConfig,
    genesisPath,
    SubjectInboundTransporter,
    SubjectOutboundTransporter,
 } from './helpers'

const aliceConfig = getBaseConfig("Alice Data", {
    genesisPath
})

const bobConfig = getBaseConfig("Bob Data", {
    genesisPath
})

const compareArrays = (arr1:GenericDataRecord[], arr2:GenericDataRecord[])=>{
    let pass = true
    arr1.forEach(record=>{
        const found = arr2.find(r=>r.id === record.id)
        if(!found)
            pass = false
    })

    arr2.forEach(record=>{
        const found = arr1.find(r=>r.id === record.id)
        if(!found)
            pass = false
    })

    return pass
}

describe('Generic Data', ()=>{
    let aliceAgent: Agent
    let bobAgent: Agent

    beforeAll(async ()=>{
        const aliceMessages = new Subject()
        const bobMessages = new Subject()

        aliceAgent = new Agent(aliceConfig)
        aliceAgent.setInboundTransporter(new SubjectInboundTransporter(aliceMessages, bobMessages))
        aliceAgent.setOutboundTransporter(new SubjectOutboundTransporter(bobMessages))
        await aliceAgent.init()

        bobAgent = new Agent(bobConfig)
        bobAgent.setInboundTransporter(new SubjectInboundTransporter(bobMessages, aliceMessages))
        bobAgent.setOutboundTransporter(new SubjectOutboundTransporter(aliceMessages))
        await bobAgent.init()
    })

    afterAll(async ()=>{
        await aliceAgent.closeAndDeleteWallet()
        await bobAgent.closeAndDeleteWallet()
    })

    test("Add and retrieve ten of the same tags", async ()=>{
        let dataArr:GenericDataRecord[] = []

        const tags:Tags = {
            multiples:"multiples"
        }

        //Add 10 generic data records
        for(let i = 1; i <= 10; i++){
            const record = await aliceAgent.dataStorage.addGenericData(
                `Multiples ${i}`,
                `${i}`,
                "text/plain",
                tags,
            )
            dataArr.push(record)
        }

        const multiples = await aliceAgent.dataStorage.queryByTags(tags)

        let pass = compareArrays(dataArr,multiples)

        expect(pass).toBe(true)
    })

    test("Create a new generic data record and delete it", async ()=>{
        let record: GenericDataRecord|null
        let success: boolean

        record = await aliceAgent.dataStorage.addGenericData(
            'deleteMe', 
            JSON.stringify({object: {object: {key:"value"}}}), 
            "application/json"
        )

        await aliceAgent.dataStorage.deleteGenericData(record)

        try{
            await aliceAgent.dataStorage.getGenericDataByKey("deleteMe")
            success = false
        }catch(err){
            success = true
        }
        
        expect(success).toBe(true)
    })

    test("Create multiple credentials with different keys and fetch them all",async ()=>{
        let dataArr:GenericDataRecord[] = []

        for(let i = 1; i <= 10; i++){
            const record = await bobAgent.dataStorage.addGenericData(
                `key${i}`,
                `Record #${i}`,
                "text/plain"
            )
            dataArr.push(record)
        }

        const allGeneric = await bobAgent.dataStorage.getAllGenericData()

        const pass = compareArrays(allGeneric, dataArr)

        expect(pass).toBe(true)
    })

    test("Create a generic data record and update the value", async()=>{
        const updatedValue = "This is the updated value!"
        let record: GenericDataRecord | null = await aliceAgent.dataStorage.addGenericData(
            "updateThis",
            "This is the old value!",
            "text/plain"
        )

        await aliceAgent.dataStorage.updateGenericDataByKey("updateThis", updatedValue)

        record = await aliceAgent.dataStorage.getGenericDataByKey("updateThis")
        
        expect(record?.value).toBe(updatedValue)

    })
})