import HDKey from 'hdkey'

import { ava, bintools } from '@/AVA'
import { ChainAlias } from '@/js/wallets/types'
import { ITransaction } from '@/components/wallet/transfer/types'
import { buildUnsignedTransaction } from '../TxHelper'
import { WalletCore } from '@/js/wallets/WalletCore'
import { updateFilterAddresses } from '../../providers'
import { digestMessage } from '@/helpers/helper'
import { HdHelper } from '@/js/HdHelper'

import { KeyPair, UTXO, UTXOSet as AVMUTXOSet } from '@c4tplatform/caminojs/dist/apis/avm'
import { BN, Buffer } from '@c4tplatform/caminojs/dist'
import { UTXOSet as PlatformUTXOSet } from '@c4tplatform/caminojs/dist/apis/platformvm/utxos'
import { SECP256k1KeyPair } from '@c4tplatform/caminojs/dist/common'

// A base class other HD wallets are based on.
// Mnemonic Wallet and LedgerWallet uses this

abstract class HdWalletCore extends WalletCore {
    chainId: string

    internalHelper: HdHelper
    externalHelper: HdHelper
    platformHelper: HdHelper

    ethHdNode: HDKey
    ethKeyPair: SECP256k1KeyPair
    hdKeysLoaded: boolean

    constructor(accountHdKey: HDKey, ethHdNode: HDKey, isPublic = true, useStaticKey = true) {
        super()
        this.ethHdNode = ethHdNode
        this.ethKeyPair = new KeyPair('', '')
        this.ethKeyPair.importKey(Buffer.from(ethHdNode.privateKey))
        this.hdKeysLoaded = false

        const staticNode = useStaticKey ? ethHdNode : undefined

        this.chainId = ava.XChain().getBlockchainAlias() || ava.XChain().getBlockchainID()
        this.externalHelper = new HdHelper('m/0', accountHdKey, staticNode, undefined, isPublic)
        this.internalHelper = new HdHelper('m/1', accountHdKey, undefined, undefined, isPublic)
        this.platformHelper = new HdHelper('m/0', accountHdKey, staticNode, 'P', isPublic)
    }

    getEvmAddressBech(): string {
        return bintools.addressToString(
            ava.getHRP(),
            'C',
            // @ts-ignore
            this.ethHdNode.pubKeyHash
        )
    }

    updateAvmUTXOSet(): void {
        // if (this.isFetchUtxos) return
        let setExternal = this.externalHelper.utxoSet as AVMUTXOSet
        let setInternal = this.internalHelper.utxoSet as AVMUTXOSet

        let joined = setInternal.merge(setExternal)
        this.utxoset = joined
    }

    getFirstAvailableAddressPlatform(): string {
        return this.platformHelper.getFirstAvailableAddress()
    }

    updateFetchState() {
        this.isFetchUtxos =
            this.externalHelper.isFetchUtxo ||
            this.internalHelper.isFetchUtxo ||
            this.platformHelper.isFetchUtxo
    }

    updateInitState() {
        this.isInit =
            this.externalHelper.isInit && this.internalHelper.isInit && this.platformHelper.isInit

        if (this.isInit) {
            updateFilterAddresses()
        }
    }
    // Fetches the utxos
    async getUTXOs(): Promise<void> {
        this.externalHelper.startUTXOFetch()
        this.internalHelper.startUTXOFetch()
        this.platformHelper.startUTXOFetch()

        await this.updateUTXOsX()
        await this.updateUTXOsP()

        return
    }

    async updateUTXOsX() {
        await this.updateUTXOsExternal()
        await this.updateUTXOsInternal()
    }

    async updateUTXOsExternal() {
        let res = await this.externalHelper.updateUtxos()
        this.updateFetchState()
        this.updateAvmUTXOSet()
    }

    async updateUTXOsInternal() {
        let utxoSet = await this.internalHelper.updateUtxos()
        this.updateFetchState()
        this.updateAvmUTXOSet()
    }

    async updateUTXOsP() {
        let utxoSet = await this.platformHelper.updateUtxos()
        this.updateFetchState()
    }

    getAllDerivedExternalAddresses(): string[] {
        return this.externalHelper.getAllDerivedAddresses()
    }

    getDerivedAddresses(): string[] {
        let internal = this.internalHelper.getAllDerivedAddresses()
        let external = this.externalHelper.getAllDerivedAddresses()
        return internal.concat(external)
    }

    getDerivedAddressesP(): string[] {
        return this.platformHelper.getAllDerivedAddresses()
    }

    getAllAddressesX() {
        let internal = this.internalHelper.getAllDerivedAddresses()
        let external = this.externalHelper.getAllAddresses()
        return internal.concat(external)
    }

    getAllAddressesP() {
        return this.platformHelper.getAllAddresses()
    }

    // Returns addresses to check for history
    getHistoryAddresses(): string[] {
        let internalIndex = this.internalHelper.hdIndex
        // They share the same address space, so whatever has the highest index
        let externalIndex = Math.max(this.externalHelper.hdIndex, this.platformHelper.hdIndex)

        let internal = this.internalHelper.getAllDerivedAddresses(internalIndex)
        let external = this.externalHelper.getAllAddresses(externalIndex)
        return internal.concat(external)
    }

    getCurrentAddressAvm(): string {
        return this.externalHelper.getCurrentAddress()
    }

    getChangeAddressAvm() {
        return this.internalHelper.getCurrentAddress()
    }

    getChangeAddressPlatform() {
        return this.platformHelper.getCurrentAddress()
    }

    getChangePath(chainId?: ChainAlias): string {
        switch (chainId) {
            case 'P':
                return this.platformHelper.changePath
            case 'X':
            default:
                return this.internalHelper.changePath
        }
    }

    getChangeIndex(chainId?: ChainAlias): number {
        switch (chainId) {
            case 'P':
                return this.platformHelper.hdIndex
            case 'X':
            default:
                return this.internalHelper.hdIndex
        }
    }

    getChangeFromIndex(idx?: number, chainId?: ChainAlias): string | null {
        if (idx === undefined || idx === null) return null

        switch (chainId) {
            case 'P':
                return this.platformHelper.getAddressForIndex(idx)
            case 'X':
            default:
                return this.internalHelper.getAddressForIndex(idx)
        }
    }

    getPlatformRewardAddress(): string {
        return this.platformHelper.getCurrentAddress()
    }

    getCurrentAddressPlatform(): string {
        return this.platformHelper.getCurrentAddress()
    }

    getStaticKeyPair(): SECP256k1KeyPair | undefined {
        return this.ethKeyPair
    }

    getPlatformUTXOSet() {
        return this.platformHelper.utxoSet as PlatformUTXOSet
    }

    getPlatformActiveIndex() {
        return this.platformHelper.hdIndex
    }

    getExternalActiveIndex() {
        return this.externalHelper.hdIndex
    }

    getBaseAddress() {
        return this.externalHelper.getAddressForIndex(0)
    }

    onNetworkChange(): void {
        this.hdKeysLoaded = false

        this.externalHelper.onNetworkChange()
        this.internalHelper.onNetworkChange()
        this.platformHelper.onNetworkChange()
    }

    async initialize() {
        if (this.hdKeysLoaded) return
        this.hdKeysLoaded = true

        this.isInit = false
        this.stakeAmount = new BN(0)

        await this.externalHelper.findHdIndex()
        await this.internalHelper.findHdIndex()
        await this.platformHelper.findHdIndex()

        this.updateInitState()
        // TODO: Handle EVM changes
    }

    async buildUnsignedTransaction(orders: (ITransaction | UTXO)[], addr: string, memo?: Buffer) {
        const changeAddress = this.getChangeAddressAvm()
        const derivedAddresses: string[] = this.getDerivedAddresses()
        const utxoset = this.getUTXOSet()

        return buildUnsignedTransaction(
            orders,
            addr,
            derivedAddresses,
            utxoset,
            changeAddress,
            memo
        )
    }

    findExternalAddressIndex(address: string): number | null {
        // TODO: Look for P addresses too
        let indexX = this.externalHelper.findAddressIndex(address)
        let indexP = this.platformHelper.findAddressIndex(address)

        let index = indexX !== null ? indexX : indexP

        if (indexX === null && indexP === null) throw new Error('Address not found.')
        return index
    }

    async signMessageByExternalAddress(msgStr: string, address: string) {
        let index = this.findExternalAddressIndex(address)
        if (index === null) throw new Error('Address not found.')
        return await this.signMessageByExternalIndex(msgStr, index)
    }

    async signMessageByExternalIndex(msgStr: string, index: number): Promise<string> {
        let digest = digestMessage(msgStr)

        // Convert to the other Buffer and sign
        let digestHex = digest.toString('hex')
        let digestBuff = Buffer.from(digestHex, 'hex')

        return await this.signHashByExternalIndex(index, digestBuff)
    }

    async signMessage(msg: string, address: string) {
        return await this.signMessageByExternalAddress(msg, address)
    }

    abstract signHashByExternalIndex(index: number, hash: Buffer): Promise<string>
}
export { HdWalletCore }
