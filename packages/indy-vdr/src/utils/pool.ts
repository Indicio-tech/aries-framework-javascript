import type { AgentContext } from '@aries-framework/core'

import { IndyVdrPoolService } from '../pool'
import { IndyVDRProxyService } from '../vdrProxy'

export function getPoolService(agentContext: AgentContext): IndyVDRProxyService | IndyVdrPoolService {
  if (agentContext.dependencyManager.isRegistered(IndyVdrPoolService))
    return agentContext.dependencyManager.resolve(IndyVdrPoolService)
  return agentContext.dependencyManager.resolve(IndyVDRProxyService)
}
