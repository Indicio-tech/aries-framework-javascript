import type { IndyVdrModuleConfigOptions } from './IndyVdrProxyModuleConfig'
import type { AgentContext, DependencyManager, Module } from '@aries-framework/core'

import { IndyVdrModuleConfig } from './IndyVdrProxyModuleConfig'
import { IndyVDRProxyService } from './vdrProxy/IndyVdrProxyService'

/**
 * @public
 * */
export class IndyVdrModule implements Module {
  public readonly config: IndyVdrModuleConfig

  public constructor(config: IndyVdrModuleConfigOptions) {
    this.config = new IndyVdrModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(IndyVdrModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(IndyVDRProxyService)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const indyVDRProxyService = agentContext.dependencyManager.resolve(IndyVDRProxyService)
  }
}
