import type { Attachment } from '../../../decorators/attachment/Attachment'
import type { RevocationInterval } from '../../credentials/models/RevocationInterval'
import type { ProofRequest, RequestedAttribute, RequestedPredicate } from '../protocol/v1/models'
import type {
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from '../protocol/v1/models/PresentationPreview'
import type { ProofAttributeInfo } from '../protocol/v1/models/ProofAttributeInfo'
import type { ProofPredicateInfo } from '../protocol/v1/models/ProofPredicateInfo'

export interface IndyProposeProofFormat {
  attributes?: PresentationPreviewAttribute[]
  predicates?: PresentationPreviewPredicate[]
  nonce: string
  name: string
  version: string
  proofPreview?: PresentationPreview
}

export interface IndyRequestProofFormat {
  name: string
  version: string
  nonce: string
  nonRevoked?: RevocationInterval
  ver?: '1.0' | '2.0'
  requestedAttributes?: Record<string, ProofAttributeInfo> | Map<string, ProofAttributeInfo>
  requestedPredicates?: Record<string, ProofPredicateInfo> | Map<string, ProofPredicateInfo>
  proofRequest?: ProofRequest
}

export interface IndyVerifyProofFormat {
  proofJson: Attachment
  proofRequest: Attachment
}

export interface IndyPresentationProofFormat {
  requestedAttributes?: Record<string, RequestedAttribute>
  requestedPredicates?: Record<string, RequestedPredicate>
  selfAttestedAttributes?: Record<string, string>
}
