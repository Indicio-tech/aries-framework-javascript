import { Logger } from "../logger";
import { OutboundPackage } from "../types";
import { AgentConfig } from "./AgentConfig";
import { MessageReceiver } from "./MessageReceiver";
import { MessageSender } from "./MessageSender";

export class TransportService {
  private agentConfig:AgentConfig;
  private logger:Logger
  
  private transportTable: TransportTable = {};

  private messageSender!:MessageSender
  private messageReceiver!:MessageReceiver

  constructor(agentConfig:AgentConfig){
    this.agentConfig = agentConfig;
    this.logger = this.agentConfig.logger
  }

  public registerMessageProcessors(messageReceiver:MessageReceiver, messageSender:MessageSender):void {
    this.messageSender = messageSender;
    this.messageReceiver = messageReceiver;
  }

  public getTransport(endpoint: string): Transport {
    //If we have a valid transport for this endpoint, use it
    const transportIDsForEndpoint = Object.keys(this.transportTable).filter(key => key === endpoint)
    
    this.logger.debug(`Transports found for Endpoint:`, transportIDsForEndpoint)
    if(transportIDsForEndpoint[0]){
      return this.transportTable[transportIDsForEndpoint[0]]
    }

    //Otherwise, identify the protocol of the endpoint and create a new transport
    const endpointURL = new URL(endpoint)
    const protocol = endpointURL.protocol
    this.logger.debug(`Endpoint Protocol: ${protocol}`)
    
    //TODO: Replace with fancy transport class detector
    if(protocol === 'ws:' || protocol === 'wss:'){
      this.transportTable[endpoint] = new WebSocketTransport(endpoint, this.logger, this.messageReceiver, this);

      return this.transportTable[endpoint];
    } 
    else if(protocol === 'http:' || protocol === 'https:'){
      return new HttpTransport(endpoint, this.logger, this.messageReceiver, this);
    }
    else{
      this.logger.error(`Unidentified procotol type: '${protocol}'`)
      throw new Error(`Unidentified procotol type: '${protocol}'`)
    }
  }

  public removeTransport(endpoint: string) {
    this.logger.debug(`Removing Transport with endpoint '${endpoint}'`)

    delete this.transportTable[endpoint]

    this.logger.debug("Transport Table:", this.transportTable)
  }
}

interface TransportTable {
  [endpoint: string]: Transport;
}

export type TransportType = 'ws' | 'http';

export interface Transport {
  type: TransportType;

  sendMessage(outboundPackage: OutboundPackage): Promise<void>
}

export class WebSocketTransport implements Transport {
  private logger:Logger
  private messageReceiver:MessageReceiver
  private transportService:TransportService

  public type: TransportType = 'ws';
  public ws: WebSocket;
  public endpoint: string;

  public constructor(endpoint: string, logger:Logger, messageReceiver:MessageReceiver, transportService:TransportService) {
    this.logger = logger
    this.messageReceiver = messageReceiver;
    this.endpoint = endpoint;
    this.transportService = transportService

    this.logger.debug(`Opening Websocket with '${endpoint}'`)
    this.ws = new WebSocket(endpoint)

    this.ws.onopen = async () => {
      this.logger.debug(`Websocket '${endpoint}' opened`);
    }

    this.ws.onclose = async (event:CloseEvent) => {
      this.logger.debug(`WebSocket '${endpoint}' closed with event:`, event)

      this.transportService.removeTransport(this.endpoint)
    }

    this.ws.onmessage = async (event:MessageEvent) => {
      this.logger.debug(`WebSocket'${endpoint}' - Received New Message`);
      
      const data = JSON.parse(Buffer.from(event.data).toString('utf-8'))
      this.logger.debug('Data JSON', data)

      const outboundPackage = await this.messageReceiver.receiveMessage(data)
      this.logger.debug("Outbound package", outboundPackage)
    }
  }

  public async sendMessage(outboundPackage: OutboundPackage): Promise<void> {
    this.logger.debug(`Attempting to sending WebSocket message to endpoint '${this.endpoint}'`);

    this.logger.debug('Message to send:', outboundPackage.payload)
    const messageToSend = Buffer.from(JSON.stringify(outboundPackage.payload))

    if(this.ws.readyState === WebSocket.OPEN){
      this.ws.send(messageToSend)
      this.logger.debug(`Sent message`);
    }
    else if(this.ws.readyState === WebSocket.CONNECTING){
      this.ws.onopen = async () => {
        this.logger.debug(`Websocket '${this.endpoint}' opened and sending message`);

        this.ws.send(messageToSend)
        this.logger.debug(`Sent message`);
      }
    }
    else {
      this.logger.warn(`Unable to send message, websocket in state '${this.ws.readyState}'`)
    }
  }
}


export class HttpTransport implements Transport {
  private logger:Logger
  private messageReceiver:MessageReceiver
  private transportService:TransportService

  public type: TransportType = 'http';
  public endpoint: string;

  public constructor(endpoint: string, logger:Logger, messageReceiver:MessageReceiver, transportService:TransportService) {
    this.logger = logger
    this.messageReceiver = messageReceiver;
    this.endpoint = endpoint;
    this.transportService = transportService
  }

  public async sendMessage(outboundPackage: OutboundPackage): Promise<void> {
    const { payload, endpoint } = outboundPackage

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
    }

    try {
        this.logger.debug("Sending message via HTTP")
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/ssi-agent-wire',
          },
          body: JSON.stringify(payload),
        })
        
        const data:any = await response.text()
        
        if(response.status == 200) {
          this.logger.debug("Response successful")
          if(data){
            this.logger.debug("Received Data in response:", data);
            const wireMessage = JSON.parse(data)
          
            this.logger.debug("Wire Message", wireMessage)

            this.messageReceiver.receiveMessage(wireMessage)
            return
          }
          else{
            return
          }
        } else {
          this.logger.warn(`Error in HTTP Response, status: '${response.status}'`, data)
          return
        }
      
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e)
      this.logger.warn('error sending message', e)
    }
  }
}
