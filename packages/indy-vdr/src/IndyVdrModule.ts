import type { IndyVdrModuleConfigOptions } from './IndyVdrModuleConfig'
import type { AgentContext, DependencyManager, Module } from '@aries-framework/core'

import { AgentConfig } from '@aries-framework/core'

import { IndyVdrApi } from './IndyVdrApi'
import { IndyVdrModuleConfig } from './IndyVdrModuleConfig'
import { IndyVdrPoolService } from './pool/IndyVdrPoolService'
import { IndyVDRProxyService } from './vdrProxy'

/**
 * @public
 * */
export class IndyVdrModule implements Module {
  public readonly config: IndyVdrModuleConfig
  public readonly api = IndyVdrApi

  public constructor(config: IndyVdrModuleConfigOptions) {
    this.config = new IndyVdrModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    // Warn about experimental module
    dependencyManager
      .resolve(AgentConfig)
      .logger.warn(
        "The '@aries-framework/indy-vdr' module is experimental and could have unexpected breaking changes. When using this module, make sure to use strict versions for all @aries-framework packages."
      )

    // Config
    dependencyManager.registerInstance(IndyVdrModuleConfig, this.config)

    // Services
    if (this.config.useProxy) {
      dependencyManager.registerSingleton(IndyVDRProxyService)
    } else {
      dependencyManager.registerSingleton(IndyVdrPoolService)
    }
    dependencyManager.registerContextScoped(IndyVdrApi)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    if (agentContext.dependencyManager.isRegistered(IndyVDRProxyService)) return
    const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

    for (const pool of indyVdrPoolService.pools) {
      if (pool.config.connectOnStartup) {
        await pool.connect()
      }
    }
  }
}
