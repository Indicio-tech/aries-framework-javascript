import type { BaseEvent } from '../../agent/Events'
import type { OutOfBandRecord } from './repository/OutOfBandRecord'

export enum OutOfBandEvents {
  ReuseAccepted = 'ReuseAccepted',
}

export interface ReuseAcceptedEvent extends BaseEvent {
  type: typeof OutOfBandEvents.ReuseAccepted
  payload: {
    outOfBandRecord: OutOfBandRecord
  }
}
