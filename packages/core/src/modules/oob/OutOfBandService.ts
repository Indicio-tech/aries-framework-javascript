import type { InboundMessageContext } from '../../agent/models/InboundMessageContext'
import type { Logger } from '../../logger'
import type { ReuseAcceptedEvent } from './OutOfBandEvents'
import type { OutOfBandState } from './domain/OutOfBandState'
import type {
  V1HandshakeReuseAcceptedMessage,
  V1_1HandshakeReuseAcceptedMessage,
} from './messages/HandshakeReuseAcceptedMessage'
import type { OutOfBandRecord } from './repository'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, map, timeout } from 'rxjs/operators'
import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { EventEmitter } from '../../agent/EventEmitter'
import { AriesFrameworkError } from '../../error'

import { OutOfBandEvents } from './OutOfBandEvents'
import { HandshakeReuseAcceptedHandler } from './handlers/HandshakeReuseAcceptedHandler'
import { OutOfBandRepository } from './repository'

@scoped(Lifecycle.ContainerScoped)
export class OutOfBandService {
  private outOfBandRepository: OutOfBandRepository
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(outOfBandRepository: OutOfBandRepository, eventEmitter: EventEmitter, config: AgentConfig) {
    this.outOfBandRepository = outOfBandRepository
    this.eventEmitter = eventEmitter
    this.logger = config.logger
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

  public async processReuseAccepted(
    messageContext: InboundMessageContext<V1_1HandshakeReuseAcceptedMessage | V1HandshakeReuseAcceptedMessage>
  ) {
    try {
      this.logger.debug('Connection reuse accepted!', { message: messageContext.message })
      const parentThreadId = messageContext.message.parentThreadId
      if (!parentThreadId) {
        throw new AriesFrameworkError(`No Parent Thread Id specified in connection reuse accepted message`)
      }
      const record = await this.findByMessageId(parentThreadId)
      if (record) {
        this.eventEmitter.emit<ReuseAcceptedEvent>({
          type: OutOfBandEvents.ReuseAccepted,
          payload: {
            outOfBandRecord: record,
          },
        })
      } else {
        throw new AriesFrameworkError(
          `Failed to find matching record for connection reuse with parent thread id '${parentThreadId}'`
        )
      }
    } catch (error) {
      this.logger.warn(`Unable to process connection reuse accepted message`, {
        message: messageContext.message,
        error: error,
      })
    }
  }

  public async returnWhenAccepted(outOfBandRecordId: string, timeoutMs = 20000): Promise<OutOfBandRecord> {
    //Ensure that the outOfBandId matches the record given from the event
    const isAccepted = (outOfBandRecord: OutOfBandRecord) => {
      return outOfBandRecord.id === outOfBandRecordId
    }

    const observable = this.eventEmitter.observable<ReuseAcceptedEvent>(OutOfBandEvents.ReuseAccepted)
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
