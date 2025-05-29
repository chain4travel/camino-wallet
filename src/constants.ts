import { BN } from '@c4tplatform/caminojs/dist'
export enum KYC_VARIANT {
    KYC_BASIC = 'kyc_basic',
    KYB_BASIC = 'kyb_basic',
}

export const MINUTE_MS = 60000
export const HOUR_MS = MINUTE_MS * 60
export const DAY_MS = HOUR_MS * 24
export const CF_IPFS_BASE = 'https://cloudflare-ipfs.com/ipfs/'
export const ZeroBN = new BN(0)
export const OneBN = new BN(1)

export type ChainIdType = 'X' | 'P' | 'C'
export type CrossChainsC = 'X' | 'P'
export type CrossChainsP = 'X' | 'C'
export type CrossChainsX = 'P' | 'C'
