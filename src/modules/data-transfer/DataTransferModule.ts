import { AgentConfig } from '../../agent/AgentConfig'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { Logger } from '../../logger'

import { DataTransferService } from './services'
import { ConnectionService } from '../connections'
import { DataTransferProvideDataMessage } from './messages'

export class DataTransfer {
  private agentConfig: AgentConfig
  private messageSender: MessageSender
  private dataTransferService: DataTransferService
  private connectionService: ConnectionService

  private logger: Logger

  public constructor(
    agentConfig: AgentConfig,
    messageSender: MessageSender,
    dataTransferService: DataTransferService,
    connectionService: ConnectionService
  ) {
    this.agentConfig = agentConfig
    this.messageSender = messageSender
    this.dataTransferService = dataTransferService
    this.logger = this.agentConfig.logger
    this.connectionService = connectionService
  }

  public async sendData(dataToSend: any, connectionId: string, goalCode: string, description?: string): Promise<void> {
    this.logger.debug(`Sending Data to Connection ${connectionId}`)

    const connection = await this.connectionService.getById(connectionId)

    const message: DataTransferProvideDataMessage = await this.dataTransferService.createProvideData(
      dataToSend,
      goalCode,
      description
    )

    const outbound = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outbound)
  }
}
