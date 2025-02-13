import indy from 'indy-sdk';
import * as dotenv from 'dotenv';
import { InitConfig } from '../lib/types';
import { TestLogger } from '../lib/__tests__/logger';
import { LogLevel } from '../lib/logger';
dotenv.config();

const agentConfig: InitConfig = {
  host: process.env.AGENT_HOST,
  port: process.env.AGENT_PORT || 3000,
  endpoint: process.env.AGENT_ENDPOINT,
  label: process.env.AGENT_LABEL || '',
  walletConfig: { id: process.env.WALLET_NAME || '' },
  walletCredentials: { key: process.env.WALLET_KEY || '' },
  publicDid: process.env.PUBLIC_DID || '',
  publicDidSeed: process.env.PUBLIC_DID_SEED || '',
  autoAcceptConnections: true,
  logger: new TestLogger(LogLevel.debug),
  indy,
};

export default agentConfig;
