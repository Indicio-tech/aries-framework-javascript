import { validateOrReject } from 'class-validator'
import { EventEmitter } from 'events'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { DataTransferProvideDataMessage } from '../messages'

export class DataTransferService extends EventEmitter {
    public constructor(){
        super()
    }

    public async createProvideData(dataToSend:any, goalCode:string, description:string = "Transfer of Data"):Promise<DataTransferProvideDataMessage> {
        const attachment = new Attachment({
            description: description,
            data: new AttachmentData({
              json: dataToSend
            }),
          })

        const provideDataMessage = new DataTransferProvideDataMessage({
            goal_code: goalCode,
            attachments: [attachment],
        })

        return provideDataMessage
    }
}