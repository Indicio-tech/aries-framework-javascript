import type { AutoAcceptProof, ProofRequestOptions } from '..'
import type { ProofProtocolVersion } from './ProofProtocolVersion'
import type { AcceptProposalFormats, CreatePresentationFormats, ProposeProofFormats } from './SharedOptions'

export interface ProposeProofOptions {
  connectionId: string
  protocolVersion: ProofProtocolVersion
  proofFormats: ProposeProofFormats
  comment?: string
  willConfirm?: boolean
  goalCode?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface NegotiateRequestOptions {
  proofRecordId: string
  proofFormats: ProposeProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface AcceptProposalOptions {
  protocolVersion: ProofProtocolVersion
  proofRecordId: string
  proofFormats: ProposeProofFormats
  goalCode?: string
  willConfirm?: boolean
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface RequestProofsOptions {
  protocolVersion: ProofProtocolVersion
  connectionId: string
  proofRequestOptions: ProposeProofFormats
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface CreateOutOfBandRequestOptions {
  protocolVersion: ProofProtocolVersion
  proofRequestOptions: CreateProofRequestOptions
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}

export type CreateProofRequestOptions = Partial<
  Pick<ProofRequestOptions, 'name' | 'nonce' | 'requestedAttributes' | 'requestedPredicates'>
>

export interface AcceptPresentationOptions {
  protocolVersion: ProofProtocolVersion
  proofRecordId: string
  comment?: string
  proofFormats: CreatePresentationFormats
}
