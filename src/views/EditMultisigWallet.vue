<template>
    <div class="msig-edit__container">
        <div class="msig-edit__form">
            <div class="input-container">
                <h3>{{ $t('create_multisig.name') }}</h3>
                <div class="input-with-warning">
                    <CamInput
                        v-model="multisigName"
                        :placeholder="$t('create_multisig.name')"
                        :error="nameLengthError"
                        :errorMessage="$t('create_multisig.errors.msig_name')"
                        :disabled="mode !== 'EDIT' || pendingEditMultisigTX"
                    />
                    <Alert variant="warning" v-if="mode === 'EDIT'">
                        {{ $t('create_multisig.alert.wize_name') }}
                    </Alert>
                </div>
            </div>

            <div class="input-container">
                <h3 style="margin-top: 10px">{{ $t('create_multisig.co-owners') }}</h3>
                <div v-for="(address, index) in addresses" :key="index" class="multisig_address">
                    <div class="msig_address_info_button">
                        <div class="circle number">{{ index + 1 }}</div>
                        <button
                            @click="removeAddress(index)"
                            class="circle delete-button mobile"
                            v-if="mode === 'EDIT'"
                        >
                            <CamTooltip
                                :content="$t('edit_multisig.label.remove_owner')"
                                placement="right"
                            >
                                <fa icon="minus"></fa>
                            </CamTooltip>
                        </button>
                    </div>
                    <div class="address-input">
                        <CamInput
                            class="full-width-input"
                            :placeholder="`Owner ${index + 1} Address`"
                            v-model="address.address"
                            :disabled="mode !== 'EDIT' || pendingEditMultisigTX"
                            :error="!isValidAddress(address.address)"
                        />
                        <CamInput
                            class="msig-address-name"
                            :placeholder="`Owner ${index + 1} Name`"
                            v-model="address.name"
                            :disabled="mode !== 'EDIT' || pendingEditMultisigTX"
                        />
                    </div>
                    <button
                        @click="removeAddress(index)"
                        class="circle delete-button desktop"
                        v-if="mode === 'EDIT'"
                    >
                        <CamTooltip
                            :content="$t('edit_multisig.label.remove_owner')"
                            placement="left"
                        >
                            <fa icon="minus"></fa>
                        </CamTooltip>
                    </button>
                </div>

                <div class="add-new-address" v-if="addresses.length < 128 && mode === 'EDIT'">
                    <div class="circle number">{{ addresses.length + 1 }}</div>
                    <div class="add-new-address--button">
                        <CamTooltip :content="$t('edit_multisig.label.add_owner')">
                            <button @click="addAddress" class="circle plus-button">
                                <fa icon="plus"></fa>
                            </button>
                        </CamTooltip>
                    </div>
                </div>

                <Alert variant="negative" v-if="multipleSameAddresses">
                    {{ $t('create_multisig.errors.same_address_twice') }}
                </Alert>
                <Alert variant="negative" v-if="mode === 'EDIT' && validAddressError">
                    {{ $t('edit_multisig.errors.invalid_addresses') }}
                </Alert>
            </div>

            <div class="divider"></div>

            <div class="input-container">
                <h3>{{ $t('edit_multisig.threshold') }}</h3>
                <CamInput
                    class="msig-threshold-input"
                    placeholder="Multisignature Threshold"
                    v-model="threshold"
                    :error="thresholdError !== ''"
                    :errorMessage="getThresholdErrorMessage"
                    :disabled="mode !== 'EDIT' || pendingEditMultisigTX"
                />
            </div>
        </div>

        <div class="alert-action_buttons">
            <div class="action_buttons" v-if="needSignatures() && alreadySigned()">
                <CamBtn variant="negative" @click="abortEditMsig(pendingEditMultisigTX?.tx)">
                    {{ $t('edit_multisig.abort') }}
                </CamBtn>
                <CamBtn variant="primary" @click="signEditMsig" :disabled="true">
                    {{
                        $t('edit_multisig.signed_edit_multisig', {
                            numberOfSignatures,
                            threshold: pendingEditMultisigTX?.tx?.threshold,
                        })
                    }}
                </CamBtn>
            </div>

            <div class="action_buttons" v-else-if="needSignatures() && !alreadySigned()">
                <CamBtn variant="negative" @click="abortEditMsig(pendingEditMultisigTX?.tx)">
                    {{ $t('edit_multisig.abort') }}
                </CamBtn>
                <CamBtn variant="primary" :loading="loading" @click="signMultisigTx">
                    {{ $t('edit_multisig.sign_edit_multisig') }}
                </CamBtn>
            </div>

            <div class="action_buttons" v-else-if="canExecuteMultisigTx()">
                <CamBtn variant="negative" @click="abortEditMsig(pendingEditMultisigTX?.tx)">
                    {{ $t('edit_multisig.abort') }}
                </CamBtn>
                <CamBtn variant="primary" :loading="loading" @click="signEditMsig">
                    {{ $t('edit_multisig.execute_edit_multisig') }}
                </CamBtn>
            </div>

            <div class="action_buttons" v-else-if="mode === 'VIEW'">
                <CamBtn variant="primary" :loading="loading" @click="startEditMsig">
                    {{ $t('edit_multisig.edit_multisig') }}
                </CamBtn>
            </div>

            <div class="action_buttons" v-else-if="mode === 'EDIT'">
                <CamBtn variant="transparent" @click="cancel">
                    {{ $t('edit_multisig.cancel') }}
                </CamBtn>
                <CamBtn
                    v-if="!canSaveEditMultisigTx"
                    variant="primary"
                    @click="abortAndSaveEditMultisig"
                    :loading="loading"
                    :disabled="!msigEdited || disableMsigCreation"
                >
                    {{ $t('edit_multisig.abort_and_save') }}
                </CamBtn>
                <CamBtn
                    v-else
                    variant="primary"
                    @click="saveEditMsig"
                    :loading="loading"
                    :disabled="!msigEdited || disableMsigCreation"
                >
                    {{ $t('edit_multisig.save_edit_multisig') }}
                </CamBtn>
            </div>

            <div class="alert--box">
                <Alert variant="warning" v-if="!canSaveEditMultisigTx && mode === 'EDIT'">
                    {{ $t('edit_multisig.save_edit_multisig_after_removal_of_pendingtx') }}
                </Alert>
                <Alert variant="warning" v-if="!pendingEditMultisigTX || canExecuteMultisigTx()">
                    {{
                        $t('create_multisig.disclamer', { fee: feeAmt, symbol: nativeAssetSymbol })
                    }}
                </Alert>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { ava, bintools } from '@/AVA'
import Alert from '@/components/Alert.vue'
import CamBtn from '@/components/CamBtn.vue'
import CamInput from '@/components/CamInput.vue'
import CamTooltip from '@/components/misc/CamTooltip.vue'
import { getMultisigAliases } from '@/explorer_api'
import { isValidPChainAddress } from '@/helpers/address_helper'
import AvaAsset from '@/js/AvaAsset'
import { AvaNetwork } from '@/js/AvaNetwork'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'
import { SingletonWallet } from '@/js/wallets/SingletonWallet'
import { WalletType } from '@/js/wallets/types'
import { MultisigTx as SignavaultTx } from '@/store/modules/signavault/types'
import { BN } from '@c4tplatform/caminojs'
import { GetTxStatusResponse, UnsignedTx } from '@c4tplatform/caminojs/dist/apis/platformvm'
import { MultisigAliasTx } from '@c4tplatform/caminojs/dist/apis/platformvm/multisigaliastx'
import { SignatureError } from '@c4tplatform/caminojs/dist/common'
import { ONEAVAX } from '@c4tplatform/caminojs/dist/utils'
import { ModelMultisigTx, ModelMultisigTxOwner } from '@c4tplatform/signavaultjs'
import { TranslateResult } from 'vue-i18n'
import { Component, Vue, Watch } from 'vue-property-decorator'
import { WalletHelper } from '../helpers/wallet_helper'

const MAX_ADDRESS_COUNT = 128
const UPDATE_ALIAS_TIMEOUT = 3000
const MAX_NAME_BYTE_SIZE = 64

@Component({
    components: {
        Alert,
        CamInput,
        CamBtn,
        CamTooltip,
    },
})
export default class EditMultisigWallet extends Vue {
    multisigName: string = ''
    threshold: number = 1
    addresses: { address: string; name: string }[] = []
    mode: 'EDIT' | 'DELETE' | 'VIEW' = 'VIEW'
    remainingFundsAddress: string = ''
    initialMultisigState: { multisigName: string; threshold: number; addresses: any[] } = {
        multisigName: '',
        threshold: 0,
        addresses: [],
    }
    loading: boolean = false

    async mounted() {
        await this.getAliasInfos()
        await this.updateInitialMultisigState()
        await this.$store.dispatch('Signavault/updateTransaction')
    }

    updateBalance(): void {
        this.$store.dispatch('updateBalances')
    }

    isValidAddress(address: string): boolean {
        if (!address) return true

        return isValidPChainAddress(address)
    }

    get activeWallet(): SingletonWallet | MultisigWallet {
        return this.$store?.state?.activeWallet
    }

    get nameLengthError() {
        const bytes = new TextEncoder().encode(this.multisigName)
        return bytes.length > MAX_NAME_BYTE_SIZE
    }

    get thresholdError() {
        const filledAddresses = this.addresses.filter((a) => a.address !== '')
        const uniqueAddresses = new Set(filledAddresses.map((a) => a.address))
        const thresholdString = String(this.threshold)

        if (isNaN(this.threshold) || /[a-zA-Z]/.test(thresholdString)) return 'invalid'
        if (this.threshold <= 0) return 'nonpositive'

        return this.threshold > uniqueAddresses.size ? 'exceeds' : ''
    }

    get getThresholdErrorMessage(): TranslateResult {
        if (this.thresholdError === 'invalid') {
            return this.$t('edit_multisig.errors.invalid_threshold')
        }
        if (this.thresholdError === 'nonpositive') {
            return this.$t('edit_multisig.errors.non_positive_threshold')
        }
        return this.$t('edit_multisig.errors.threshold_exceeds_owners')
    }

    get multipleSameAddresses(): boolean {
        const filledAddresses = this.addresses.filter((a) => a.address !== '')
        const uniqueAddresses = new Set(filledAddresses.map((a) => a.address))

        return uniqueAddresses.size !== filledAddresses.length
    }

    get activeNetwork(): null | AvaNetwork {
        return this.$store?.state?.Network?.selectedNetwork
    }

    get walletType(): WalletType | string {
        return this.activeWallet?.type
    }

    get feeAmt(): string {
        return this.formattedAmount(ava.PChain().getTxFee())
    }

    get nativeAssetSymbol(): string {
        return this.ava_asset?.symbol ?? ''
    }

    get ava_asset(): AvaAsset | null {
        return this.$store.getters['Assets/AssetAVA']
    }

    get numberOfSignatures(): number {
        let signers = 0
        this.txOwners().forEach((owner) => {
            if (owner.signature) signers++
        })
        return signers
    }

    get pendingSignavaultTXs(): SignavaultTx[] {
        return this.$store.getters['Signavault/transactions']
    }

    get canSaveEditMultisigTx(): boolean {
        if (!this.pendingEditMultisigTX && this.pendingSignavaultTXs?.length > 0) {
            return false
        }
        return true
    }

    get pendingEditMultisigTX(): SignavaultTx | undefined {
        return this.pendingSignavaultTXs.find(
            (item: any) =>
                item?.tx?.alias === this.activeWallet?.getAllAddressesP()[0] &&
                WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx) === 'MultisigAliasTx'
        )
    }

    get disableMsigCreation(): boolean {
        const filledAddresses = this.addresses.filter((a) => a.address !== '')
        const uniqueAddresses = new Set(filledAddresses.map((a) => a.address))

        return (
            !this.threshold ||
            filledAddresses.length === 0 ||
            uniqueAddresses.size !== filledAddresses.length ||
            this.thresholdError !== '' ||
            this.nameLengthError ||
            this.validAddressError
        )
    }

    get msigEdited(): boolean {
        return (
            this.multisigName !== this.initialMultisigState.multisigName ||
            this.threshold !== this.initialMultisigState.threshold ||
            JSON.stringify(this.addresses) !== JSON.stringify(this.initialMultisigState.addresses)
        )
    }

    updateInitialMultisigState() {
        this.initialMultisigState = {
            multisigName: this.multisigName,
            threshold: this.threshold,
            addresses: JSON.parse(JSON.stringify(this.addresses)),
        }
    }

    get validAddressError(): boolean {
        const filledAddresses = this.addresses.filter((a) => a.address !== '')

        for (const addressObj of filledAddresses) {
            if (!isValidPChainAddress(addressObj.address)) return true
        }

        return false
    }

    @Watch('activeWallet')
    @Watch('activeNetwork')
    @Watch('pendingEditMultisigTX')
    async getAliasInfos() {
        this.mode = 'VIEW'

        await this.setAliasInfoFromActiveWallet()
        this.updateInitialMultisigState()
        await this.assignSavedAddressNames()
    }

    async setAliasInfoFromActiveWallet() {
        const hrp = ava.getHRP()

        // Check if pendingEditMultisigTX exists
        if (this.pendingEditMultisigTX) {
            let unsignedTx = new UnsignedTx()
            // @ts-ignore
            unsignedTx.fromBuffer(Buffer.from(this.pendingEditMultisigTX.tx?.unsignedTx, 'hex'))

            const utx = unsignedTx.getTransaction() as MultisigAliasTx
            const alias = utx.getMultisigAlias()

            this.multisigName = await alias.getMemo().toString()
            this.threshold = await alias.getOwners().getThreshold()
            this.addresses = await alias
                .getOwners()
                .getOutput()
                .getAddresses()
                .map((address) => {
                    return { address: bintools.addressToString(hrp, 'P', address), name: '' }
                })
        } else {
            const msigAlias = this.activeWallet?.getStaticAddress('P')
            if (!msigAlias) return
            const msigData = await ava.PChain().getMultisigAlias(msigAlias)

            this.multisigName = Buffer.from(msigData.memo.replace('0x', ''), 'hex').toString()
            this.threshold = msigData.threshold
            this.addresses = msigData.addresses.map((address) => ({ address, name: '' }))
        }
    }

    async assignSavedAddressNames() {
        const savedAddresses = await this.getSavedMultisignatureAddresses()
        this.addresses = this.addresses.map((address) => {
            const savedAddress = savedAddresses.find(
                (a: { address: string; name: string }) => a.address === address.address
            )
            if (savedAddress) {
                address.name = savedAddress.name
            }
            return address
        })
    }

    async getSavedMultisignatureAddresses() {
        const localStorageAccountIndex = this.$store.state.Accounts.accountIndex
        let accounts = JSON.parse(localStorage.getItem('accounts') || '[]')

        if (
            accounts[localStorageAccountIndex] &&
            accounts[localStorageAccountIndex].multisignatures
        ) {
            const lastMultisignature = accounts[localStorageAccountIndex].multisignatures.slice(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                -1
            )[0]

            if (lastMultisignature) return lastMultisignature.addresses
        }

        return []
    }

    formattedAmount(val: BN): string {
        return `${(Number(val.toString()) / Number(ONEAVAX.toString())).toLocaleString()}`
    }

    addAddress(): void {
        if (this.addresses.length >= MAX_ADDRESS_COUNT) return
        this.addresses.push({ address: '', name: '' })
    }

    removeAddress(index: number): void {
        this.addresses.splice(index, 1)
        if (this.addresses.length === 0) this.addAddress()
    }

    deleteMsig(): void {
        this.mode = 'DELETE'
    }

    startEditMsig(): void {
        this.mode = 'EDIT'
    }

    txOwners(): ModelMultisigTxOwner[] | [] {
        return this.pendingEditMultisigTX?.tx?.owners ?? []
    }

    canExecuteMultisigTx(): boolean {
        let signers = 0
        let threshold = this.pendingEditMultisigTX?.tx?.threshold
        const txOwners = this.txOwners()

        txOwners.forEach((owner) => {
            if (owner.signature) signers++
        })
        if (threshold) return signers >= threshold

        return false
    }

    needSignatures(): boolean {
        let threshold = this.pendingEditMultisigTX?.tx?.threshold
        let numberOfSignatures = this.numberOfSignatures

        if (threshold && numberOfSignatures < threshold) return true
        return false
    }

    alreadySigned(): boolean {
        const txOwners = this.txOwners()
        if (!txOwners || txOwners.length === 0) return false

        const walletAddresses = (this.activeWallet as MultisigWallet)?.wallets?.map(
            (w) => w?.getAllAddressesP()?.[0]
        )
        if (!walletAddresses) return false

        const isSigned = txOwners.some((owner) => {
            if (!owner) return false
            const isOwnerSigned = owner.signature && walletAddresses.includes(owner.address)
            return isOwnerSigned
        })

        return isSigned
    }

    getNonEmptyAddresses(addresses: { address: string; name: string }[] = []): string[] {
        return addresses
            .filter((address) => address.address.trim() !== '')
            .map((address) => address.address)
    }

    async saveEditMsig() {
        // @ts-ignore
        const { dispatchNotification, updateShowAlias } = this.globalHelper()
        const getNonEmptyAddresses = this.getNonEmptyAddresses(this.addresses)
        const nonEmptyInitialAddresses = this.getNonEmptyAddresses(
            this.initialMultisigState.addresses
        )

        const alias = this.activeWallet?.getStaticAddress('P')

        // if only address name changed, update alias in local storage
        if (this.multisigAddressNamesEdited && !this.pendingEditMultisigTX) {
            // update only local storage
            this.updateMultisigAccountInLocalStorage()
            this.mode = 'VIEW'
            dispatchNotification({
                message: this.$t('notifications.msig_edit_address_name_success'),
                type: 'success',
            })
            return
        }

        if (!this.pendingEditMultisigTX) {
            try {
                this.loading = true
                let wallet = this.activeWallet as MultisigWallet
                await wallet.setKey()
                const result = await WalletHelper.sendMultisigAliasTxUpdate(
                    this.activeWallet as MultisigWallet,
                    nonEmptyInitialAddresses,
                    getNonEmptyAddresses,
                    this.multisigName,
                    this.initialMultisigState.threshold,
                    this.threshold,
                    alias
                )

                if (!result) {
                    // multisig workflow
                    await this.$store.dispatch('Signavault/updateTransaction')
                    dispatchNotification({
                        message: this.$t('notifications.transfer_success_msg'),
                        type: 'success',
                    })
                    return this.updateMultisigTxDetails()
                }

                this.updateBalance()
                this.updateMultisigTxDetails()
                this.updateMultisigAccountInLocalStorage()
                await this.$store.dispatch('Signavault/updateTransaction')
                setTimeout(() => updateShowAlias(), UPDATE_ALIAS_TIMEOUT)
                dispatchNotification({
                    message: this.$t('notifications.transfer_success_msg'),
                    type: 'success',
                })
                this.mode = 'VIEW'
            } catch (err: any) {
                this.handleMsigEditError(err)
            } finally {
                this.loading = false
            }
        } else {
            this.loading = true
            await this.issueMultisigTx()
            setTimeout(() => updateShowAlias(), UPDATE_ALIAS_TIMEOUT)
            this.loading = false
        }
    }

    // ------------------------- MSIG EDIT ERROR HANDLING ------------------------- //
    getErrorMessage(error: any): string {
        if (error?.message.includes('insufficient balance'))
            return 'notifications.insufficient_funds_edit'
        return error.message
    }

    handleMsigEditError(error: any) {
        // @ts-ignore
        const { dispatchNotification } = this.globalHelper()

        if (error instanceof SignatureError) {
            this.updateMultisigAccountInLocalStorage()
            this.$store.dispatch('Signavault/updateTransaction')
            dispatchNotification({
                message: this.$t('notifications.multisig_transaction_saved'),
                type: 'success',
            })
        } else {
            const errorMessage = this.getErrorMessage(error)
            console.error('Error in saveEditMsig:', error)

            dispatchNotification({
                message: this.$t(errorMessage),
                type: 'error',
            })
        }

        this.loading = false
    }

    // ------------------------------------------------------------------------- //

    async cancel() {
        await this.getAliasInfos()
        this.mode = 'VIEW'
    }

    async waitTxConfirm(txId: string) {
        let status = (await ava.PChain().getTxStatus(txId)) as GetTxStatusResponse
        // @ts-ignore
        let { dispatchNotification } = this.globalHelper()

        if (status?.status === 'Unknown' || status?.status === 'Processing') {
            setTimeout(() => this.waitTxConfirm(txId), 500)
        } else if (status?.status === 'Dropped') {
            dispatchNotification({
                message: this.$t('notifications.msig_edit_failed'),
                type: 'error',
            })
        } else {
            await this.getAliasInfos()
            this.updateInitialMultisigState()
        }
    }

    async abortEditMsig(tx?: ModelMultisigTx) {
        try {
            this.loading = true
            const wallet = this.activeWallet as MultisigWallet

            if (tx) {
                await wallet.cancelExternal(tx)
                await this.$store.dispatch('Signavault/updateTransaction')
                this.getAliasInfos()
                this.mode = 'VIEW'
            }
            this.loading = false
        } catch (err) {
            this.loading = false
            console.error(err)
        }
    }

    async signEditMsig() {
        await this.saveEditMsig()
        this.mode = 'VIEW'
    }

    async abortAndSaveEditMultisig() {
        this.abortEditMsig(this.pendingSignavaultTXs[0].tx).then(() => this.saveEditMsig())
    }

    async signMultisigTx() {
        // @ts-ignore
        let { dispatchNotification } = this.globalHelper()
        const wallet = this.activeWallet
        if (!wallet || !(wallet instanceof MultisigWallet))
            return console.debug('MultiSigTx::sign: Invalid wallet')
        if (!this.pendingEditMultisigTX) return console.debug('MultiSigTx::sign: Invalid Tx')
        try {
            await wallet.addSignatures(this.pendingEditMultisigTX?.tx)
            dispatchNotification({
                message: this.$t('notifications.multisig_transaction_saved'),
                type: 'success',
            })
            this.$store.dispatch('Signavault/updateTransaction')
        } catch (e: any) {
            dispatchNotification({
                message: this.$t('multisig_transaction_not_saved'),
                type: 'error',
            })
        }
    }

    async issueMultisigTx() {
        // @ts-ignore
        let { dispatchNotification } = this.globalHelper()
        const wallet = this.activeWallet
        if (!wallet || !(wallet instanceof MultisigWallet))
            return console.error('MultiSigTx::sign: Invalid wallet')
        if (!this.pendingEditMultisigTX) return console.error('MultiSigTx::sign: Invalid Tx')
        try {
            const msigAlias = this.activeWallet?.getStaticAddress('P')
            await this.updateMultisigTxDetails()
            const txId = await wallet.issueExternal(this.pendingEditMultisigTX?.tx)
            this.waitTxConfirm(txId)
            this.$store.dispatch('Signavault/updateTransaction')
            dispatchNotification({
                message: this.$t('notifications.msig_edit_success', { address: msigAlias }),
                type: 'success',
            })
            await this.fetchMultisigAliases()
            setTimeout(async () => {
                const staticAddresses = this.$store.getters['staticAddresses']('P')
                const multisigAliases = await getMultisigAliases(staticAddresses)
                if (!multisigAliases.includes(msigAlias.replace('P-', '')))
                    await this.$store.dispatch('activateWallet', this.$store.state.wallets[0])
            }, 3000)
        } catch (e: any) {
            console.error('MultiSigTx::sign: Error', e)
            await this.getAliasInfos()
            dispatchNotification({
                message: this.$t('notifications.msig_edit_failed'),
                type: 'error',
            })
            this.loading = false
            throw e
        }
    }

    async fetchMultisigAliases(): Promise<void> {
        // Fetch multisig aliases after a delay
        setTimeout(async () => {
            const aliasesResponse =
                (await this.$store.dispatch('fetchMultiSigAliases', {
                    disable: false,
                })) || []
            const aliases = aliasesResponse.map((alias: string): string => 'P-' + alias)
            await this.$store.dispatch('editWalletsMultisig', { keys: aliases })
        }, 3000)
    }

    async updateMultisigTxDetails() {
        const msigAlias = this.activeWallet?.getStaticAddress('P')
        const msigData = await ava.PChain().getMultisigAlias(msigAlias)

        this.multisigName = Buffer.from(msigData.memo.replace('0x', ''), 'hex').toString()
        this.threshold = msigData.threshold
        this.addresses = msigData.addresses.map((address) => {
            return { address, name: '' }
        })

        const savedAddresses = await this.getSavedMultisignatureAddresses()
        this.addresses = this.addresses.map((address) => {
            const savedAddress = savedAddresses.find(
                (a: { address: string; name: string }) => a.address === address.address
            )
            if (savedAddress) address.name = savedAddress.name

            return address
        })
    }

    get multisigAddressNamesEdited(): boolean {
        const addressFields = this.addresses.map((item) => item.address)
        const initialAddressesFields = this.initialMultisigState.addresses.map(
            (item) => item.address
        )

        if (
            this.multisigName !== this.initialMultisigState.multisigName ||
            this.threshold !== this.initialMultisigState.threshold ||
            JSON.stringify(addressFields) !== JSON.stringify(initialAddressesFields)
        )
            return false
        else {
            for (let i = 0; i < this.addresses.length; i++) {
                if (this.addresses[i].name !== this.initialMultisigState.addresses[i].name)
                    return true
            }
        }

        return false
    }

    async updateMultisigAccountInLocalStorage() {
        try {
            const msigAlias = this.activeWallet?.getStaticAddress('P')
            const localStorageAccountIndex = this.$store.state.Accounts.accountIndex

            if (localStorageAccountIndex === null || localStorageAccountIndex === undefined) return

            let accounts = JSON.parse(localStorage.getItem('accounts') || '[]')
            if (accounts[localStorageAccountIndex]) {
                if (!accounts[localStorageAccountIndex].multisignatures)
                    accounts[localStorageAccountIndex].multisignatures = []

                // Filter out empty addresses
                const filteredAddresses = this.addresses.filter(
                    (addressObj) => addressObj.address.trim() !== ''
                )

                const multisignature = {
                    alias: msigAlias,
                    addresses: filteredAddresses,
                }

                const targetMultisignatures = accounts[localStorageAccountIndex].multisignatures

                // Check if the multisignature with the given alias exists
                const existingMultisigIndex = targetMultisignatures.findIndex(
                    // @ts-ignore
                    (m) => m.alias === msigAlias
                )

                // If it exists, replace it with the new multisignature object
                if (existingMultisigIndex !== -1)
                    targetMultisignatures[existingMultisigIndex] = multisignature
                else targetMultisignatures.push(multisignature)

                accounts[localStorageAccountIndex].multisignatures = targetMultisignatures
                localStorage.setItem('accounts', JSON.stringify(accounts))
            } else console.warn(`Account with index ${localStorageAccountIndex} does not exist.`)
        } catch (err) {
            console.warn('Error:', err)
        }
    }
}
</script>

<style scoped lang="scss">
@use '../styles/abstracts/mixins';
.msig-edit {
    &__container {
        margin-top: 4rem;
        margin-bottom: 4rem;
        height: 100%;
        color: var(--primary-color);
        gap: 1rem;
        h1 {
            color: var(--camino-slate-slate-white);
            font-family: Inter;
            font-size: 28px;
            font-style: normal;
            font-weight: 600;
            line-height: 36px;
            margin-bottom: 20px;
            padding: 16px 0px 0px 0px;
        }
    }
    &__form {
        gap: 16px;
        display: flex;
        flex-direction: column;
        padding: 16px 0px;
    }
}

.input-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    h3 {
        color: var(--camino-slate-slate-white);
        font-family: Inter;
        font-size: 20px;
        font-style: normal;
        font-weight: 600;
        line-height: 32px;
    }
}

input {
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--camino-slate-slate-600, #475569);
    &:focus {
        border-color: var(--camino-brand-too-blue-to-be-true);
        box-shadow: 0px 0px 0px 3px var(--camino-brand-too-blue-to-be-true-100);
    }
}

.full-width-input {
    flex: 1;
}

.input-with-warning {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.warning {
    color: var(--warning);
    font-size: 13px;
}

.error-message {
    color: var(--error);
}

.address-input {
    display: flex;
    justify-content: center;
    flex-direction: row;
    gap: 1rem;
    width: calc(100% - 51px);
}

.msig-address-name {
    width: 100%;
    max-width: 250px;
}

.multisig_address {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.circle {
    border: 2px solid var(--camino-slate-slate-600);
    cursor: pointer;
    justify-content: center;
    align-items: center;
    display: flex;
    border-radius: 100%;
    padding: 10px;
}

.number {
    width: 35px !important;
    height: 35px !important;
    cursor: default;
}

.plus-button {
    border: 2px solid var(--camino-success-color);
    font-size: 10px;
    width: 40px !important;
    height: 40px !important;
    svg {
        color: var(--camino-success-color);
    }
}

.add-new-address {
    display: flex;
    align-items: center;
    gap: 1rem;
    &--button {
        display: flex;
        justify-content: center;
        align-items: center;
        flex: 1;
    }
}

.divider {
    margin-top: 16px;
    margin-bottom: 16px;
    border-bottom: 2px solid var(--bg-light);
}

.action-buttons {
    margin-left: auto;
    flex-direction: column;
    justify-content: flex-end;
    display: flex;
    // flex-direction: column;
    flex-direction: row;
    align-items: flex-end;
    max-width: fit-content;
    margin-top: 1rem;
    gap: 0.5rem;
    width: auto;
}

.alert-action_buttons {
    display: flex;
    flex-direction: column;
    margin: 0.5rem 0rem 0.5rem 0rem;
    gap: 0.5rem;

    & > * {
        margin-left: auto;
        justify-content: flex-end;
    }
}

.action_buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.5rem 0rem 0.5rem 0rem;
}

.delete-button {
    border: 2px solid var(--camino-error-color);
    width: 35px !important;
    height: 35px !important;
    svg {
        color: var(--camino-error-color);
    }
}
.delete-button.mobile {
    display: none;
}

.delete-button.desktop {
    display: flex;
}

.msig_address_info_button {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.alert--box {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 600px;
}

[data-theme='light'] {
    h1,
    h3 {
        color: var(--camino-slate-slate-950, #020617);
    }
}

@include mixins.mobile-device {
    .address-input {
        flex-direction: column;
    }

    .msig-address-name {
        width: 100%;
        max-width: 100%;
    }

    .multisig_address {
        gap: 0.5rem;
    }

    .delete-button.mobile {
        display: flex;
    }

    .delete-button.desktop {
        display: none;
    }
}
</style>
<style lang="scss">
@use '../styles/abstracts/mixins';
.msig-threshold-input,
.msig-remaining-funds-input {
    width: 100%;
    input {
        max-width: 900px;
    }
}

@include mixins.mobile-device {
    .msig-threshold-input {
        width: 100%;
        input {
            max-width: 100%;
        }
    }
}
</style>
