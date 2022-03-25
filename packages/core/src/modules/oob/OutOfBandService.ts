import type { OutOfBandState } from './domain/OutOfBandState'
import { OutOfBandRecord } from './repository'
import { first, map, timeout } from 'rxjs/operators'

import { scoped, Lifecycle } from 'tsyringe'

import { OutOfBandRepository } from './repository'
import { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import { HandshakeReuseAcceptedHandler } from './handlers/HandshakeReuseAcceptedHandler'
import { V1HandshakeReuseAcceptedMessage, V1_1HandshakeReuseAcceptedMessage } from './messages/HandshakeReuseAcceptedMessage'
import { EventEmitter } from '../../agent/EventEmitter'
import { OutOfBandEvents, ReuseAcceptedEvent } from './OutOfBandEvents'
import { firstValueFrom, ReplaySubject } from 'rxjs'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandService {
  private outOfBandRepository: OutOfBandRepository
  private eventEmitter: EventEmitter

  public constructor(outOfBandRepository: OutOfBandRepository, eventEmitter: EventEmitter) {
    this.outOfBandRepository = outOfBandRepository
    this.eventEmitter = eventEmitter
  }

  public async save(outOfBandRecord: OutOfBandRecord) {
    return this.outOfBandRepository.save(outOfBandRecord)
  }

  public async updateState(outOfBandRecord: OutOfBandRecord, newState: OutOfBandState) {
    outOfBandRecord.state = newState
    return this.outOfBandRepository.update(outOfBandRecord)
  }

  public async findById(outOfBandRecordId: string) {
    return this.outOfBandRepository.findById(outOfBandRecordId)
  }

  public async findByMessageId(messageId: string) {
    return this.outOfBandRepository.findSingleByQuery({ messageId })
  }

  public async findByRecipientKey(recipientKey: string) {
    return this.outOfBandRepository.findSingleByQuery({ recipientKey })
  }

  public async getAll() {
    return this.outOfBandRepository.getAll()
  }

  public async processReuseAccepted(messageContext: InboundMessageContext<V1_1HandshakeReuseAcceptedMessage | V1HandshakeReuseAcceptedMessage>) {
    console.log("Connection reuse accepted!", messageContext.message)
    const record = await this.findByMessageId(messageContext.message.threadId)
    if(record){
      this.eventEmitter.emit<ReuseAcceptedEvent>({
        type: OutOfBandEvents.ReuseAccepted,
        payload: {
          outOfBandRecord: record
        }
      })
    }else{
      console.error("Failed to find matching record for connection reuse")
    }
    
  }
  

  public async returnWhenAccepted(outOfBandId: string, timeoutMs = 20000): Promise<OutOfBandRecord> {
    //Ensure that the outOfBandId matches the record given from the event
    const isAccepted = (outOfBandRecord: OutOfBandRecord) => {
      return outOfBandRecord.id === outOfBandId
    }

    const observable = this.eventEmitter.observable<ReuseAcceptedEvent>(
      OutOfBandEvents.ReuseAccepted
    )
    const subject = new ReplaySubject<OutOfBandRecord>(1)

    observable
      .pipe(
        map((e) => e.payload.outOfBandRecord),
        first(isAccepted),
        timeout(timeoutMs)
      )
      .subscribe(subject)
      
    return firstValueFrom(subject)
  }

}
