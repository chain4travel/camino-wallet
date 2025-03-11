<template>
    <div>
        <modal ref="modal" :title="title">
            <div class="modal__body">
                <CamOfferCard type="offer" :offer="offer" />
                <template v-if="!isWhiteListing">
                    <div>
                        <form class="deposit_row">
                            <div class="deposit_inputs">
                                <div class="deposit_inputs__element">
                                    <label>Deposit duration</label>
                                    <DateForm
                                        v-if="!pendingDepositTX"
                                        @change_end="setEndDate"
                                        :maxEndDate="maxEndDate"
                                        :minDurationMs="minDuration"
                                        :maxDurationMs="maxDuration"
                                        :defaultDurationMs="maxDuration"
                                    ></DateForm>
                                    <span v-if="!pendingTxduration" class="deposit_duration">
                                        {{ formatDuration(duration) }}
                                    </span>
                                    <span v-else class="deposit_duration">
                                        {{ formatDuration(pendingTxduration) }}
                                    </span>
                                </div>
                                <!-- <span v-if="rewardOwner">{{ rewardOwner }}</span> -->
                                <!-- <div class="deposit_inputs__element">
                                    <label>Reward Owner</label>
                                    <CamInput
                                        :placeholder="`Rewrad Owner`"
                                        v-model="rewardOwner"
                                        class="reward-input"
                                        :error="rewardOwnerError"
                                        :errorMessage="rewardOwnerError"
                                        style="flex: 1"
                                    />
                                </div> -->
                                <div class="deposit_inputs__element">
                                    <label>Deposit Owner</label>
                                    <CamInput
                                        :placeholder="`Deposit Owner`"
                                        v-model="depositOwner"
                                        class="reward-input"
                                        :error="depositOwnerError"
                                        :errorMessage="depositOwnerError"
                                        style="flex: 1"
                                        :disabled="pendingDepositTX"
                                    />
                                </div>
                                <!-- <label style="margin-top: 16px">Deposit Owner</label>
                                <CamInput
                                    :placeholder="`Deposit Owner`"
                                    v-model="depositOwner"
                                    class="reward-input"
                                /> -->
                                <div class="deposit_inputs__element">
                                    <label>
                                        {{ $t('earn.rewards.active_earning.deposit_amount') }}
                                    </label>
                                    <AvaxInput
                                        v-if="pendingTxamount"
                                        :max="maxDepositAmount"
                                        v-model="amt"
                                        :initial="pendingTxamount * 1000000000"
                                        :readonly="pendingDepositTX"
                                    ></AvaxInput>
                                    <AvaxInput
                                        v-else
                                        :max="maxLeftToDeposit"
                                        v-model="amt"
                                        :readonly="maxLeftToDeposit.isZero()"
                                    ></AvaxInput>
                                </div>
                                <Alert v-if="pendingDepositTX" variant="info">
                                    {{
                                        $t('earn.validate.pending_multisig.threshold', {
                                            value: sigValue,
                                            threshold: pendingDepositTX?.tx.threshold,
                                        })
                                    }}
                                </Alert>
                                <Alert v-if="SignStatus" variant="info">
                                    {{ $t('earn.validate.pending_multisig.already_signed') }}
                                </Alert>
                            </div>
                            <div class="submit_box">
                                <template v-if="pendingDepositTX">
                                    <div class="multi-sig__container">
                                        <button
                                            class="camino__negative--button"
                                            @click.prevent="openAbortModal"
                                        >
                                            {{ $t('transfer.multisig.abort_transaction') }}
                                        </button>
                                        <button
                                            v-if="canExecuteMultisigTx"
                                            :class="['camino__primary--button']"
                                            @click.prevent="issueMultisigTx"
                                        >
                                            {{ $t('transfer.multisig.execute_transaction') }}
                                        </button>
                                        <button
                                            v-else
                                            :class="[
                                                'camino__primary--button',
                                                { 'camino--button--disabled': disableSignButton },
                                            ]"
                                            @click.prevent="signMultisigTx"
                                            :disabled="disableSignButton"
                                        >
                                            {{ $t('transfer.multisig.sign_transaction') }}
                                        </button>
                                    </div>
                                </template>
                                <template v-else>
                                    <div class="button--container">
                                        <button
                                            class="camino__negative--button"
                                            @click.prevent="cancelDeposit"
                                        >
                                            {{ $t('earn.validate.cancel') }}
                                        </button>
                                        <button
                                            v-if="$listeners['selectOffer']"
                                            :class="[
                                                'camino__primary--button',
                                                { 'camino--button--disabled': isDepositDisabled },
                                            ]"
                                            @click.prevent="submitDeposit"
                                            :disabled="
                                                isDepositDisabled ||
                                                amt.gt(maxLeftToDeposit) ||
                                                maxLeftToDeposit.isZero()
                                            "
                                        >
                                            {{ $t('earn.rewards.offer.deposit') }}
                                        </button>
                                    </div>
                                    <Alert variant="warning">
                                        Creating this depositOffer will incurr a fee of
                                        {{ feeAmt }} {{ nativeAssetSymbol }}
                                    </Alert>
                                </template>
                            </div>
                        </form>
                    </div>
                </template>
                <template v-else>
                    <div class="whitelisting__container">
                        <label style="margin-top: 16px">
                            {{ $t('earn.rewards.offer.add_new_addresses') }}
                        </label>
                        <div class="addresses_container input">
                            <div v-for="(address, index) in addresses" :key="index">
                                <div class="address_container">
                                    <button
                                        @click="removeAddress(index)"
                                        class="circle delete-button"
                                    >
                                        <fa icon="minus"></fa>
                                    </button>
                                    <CamInput
                                        class="input"
                                        :error="!isValidAddress(address.address)"
                                        :errorMessage="$t('earn.rewards.errors.invalid_address')"
                                        v-model="address.address"
                                    />
                                </div>
                            </div>
                            <button @click.prevent="addAddress" class="circle plus-button">
                                <fa icon="plus"></fa>
                            </button>
                        </div>
                        <Alert v-if="multupleSameAddresses" variant="negative">
                            {{ $t('earn.rewards.errors.same_address_twice') }}
                        </Alert>
                        <Alert v-if="isEmptyAddress" variant="negative">
                            {{ $t('earn.rewards.errors.empty_addresses') }}
                        </Alert>
                        <CamBtn
                            class="button-submit"
                            variant="primary"
                            :onClick="addNewAddresses"
                            :disabled="canAddWhitelisting || isEmptyAddress"
                        >
                            {{ $t('earn.rewards.claim_modal.confirm') }}
                        </CamBtn>
                    </div>
                </template>
            </div>
        </modal>

        <ModalAbortSigning
            ref="modal_abort_signing"
            :title="$t('transfer.multisig.abort_transaction')"
            :modalText="$t('earn.rewards.abort_modal.message')"
            @cancelTx="cancelMultisigTx"
        />
    </div>
</template>
<script lang="ts">
import Alert from '@/components/Alert.vue'
import CamBtn from '@/components/CamBtn.vue'
import AvaxInput from '@/components/misc/AvaxInput.vue'
import CamTooltip from '@/components/misc/CamTooltip.vue'
import { bnToBig, cleanAvaxBN, formatDuration } from '@/helpers/helper'
import { WalletHelper } from '@/helpers/wallet_helper'
import AvaAsset from '@/js/AvaAsset'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'
import { WalletType } from '@/js/wallets/types'
import { BN } from '@c4tplatform/caminojs'
import { DepositOffer } from '@c4tplatform/caminojs/dist/apis/platformvm'
import { SignatureError, ZeroBN } from '@c4tplatform/caminojs/dist/common'
import 'reflect-metadata'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import Modal from '../../modals/Modal.vue'

import { MultisigTx as SignavaultTx } from '@/store/modules/signavault/types'

import { ava, bintools } from '@/AVA'
import CamInput from '@/components/CamInput.vue'
import CamOfferCard from '@/components/CamOfferCard.vue'
import ModalAbortSigning from '@/components/wallet/earn/ModalAbortSigning.vue'
import { isValidPChainAddress } from '@/helpers/address_helper'
import { Buffer } from '@c4tplatform/caminojs/dist'
import { DepositTx, UnsignedTx } from '@c4tplatform/caminojs/dist/apis/platformvm'
import { ONEAVAX } from '@c4tplatform/caminojs/dist/utils'
import DateForm from './DateForm.vue'

@Component({
    components: {
        Modal,
        DateForm,
        AvaxInput,
        ModalAbortSigning,
        Alert,
        CamInput,
        CamOfferCard,
        CamTooltip,
        CamBtn,
    },
})
export default class ModalDepositFunds extends Vue {
    @Prop() offer!: DepositOffer
    @Prop() title!: string
    @Prop() error!: boolean
    @Prop() warning!: boolean
    @Prop() isDepositDisabled!: boolean
    @Prop() maxDepositAmount!: BN
    @Prop() isWhiteListing?: boolean
    addresses: { address: string }[] = [{ address: '' }]
    // @ts-ignore
    helpers = this.globalHelper()
    amt: BN = ZeroBN
    ini: BN = new BN(5000000000)
    endDate: string = ''
    rewardOwner: string = ''
    depositOwner: string = ''
    rewardOwnerError: string = ''
    depositOwnerError: string = ''

    $refs!: {
        modal: Modal
        modal_abort_signing: ModalAbortSigning
    }

    @Watch('depositOwner')
    onDepositOwnerChange() {
        this.depositOwnerError = isValidPChainAddress(this.depositOwner) ? '' : 'Invalid address'
    }
    async addNewAddresses(): Promise<void> {
        try {
            const filledAddresses = this.addresses.filter((a) => a.address !== '')
            let result = await this.$store.dispatch('Platform/addAllowedAddresses', {
                depositOfferID: this.offer.id,
                allowedAddresses: filledAddresses,
                timestamp: this.offer.start.toNumber(),
            })
            this.addresses = [{ address: '' }]
            this.helpers.dispatchNotification({
                message: this.$t('earn.rewards.offer.add_new_addresses_succeeded'),
                type: 'success',
            })
        } catch (e) {
            this.helpers.dispatchNotification({
                message: `Duplicate entry`,
                type: 'error',
            })
        }
    }
    removeAddress(index: number): void {
        this.addresses.splice(index, 1)
        if (this.addresses.length === 0) this.addAddress()
    }
    addAddress(): void {
        if (this.addresses.length >= 128) return
        this.addresses.push({ address: '' })
    }
    get activeWallet(): MultisigWallet {
        return this.$store.state.activeWallet
    }
    get pendingDepositTX(): SignavaultTx | undefined {
        return this.$store.getters['Signavault/transactions'].find(
            (item: SignavaultTx) =>
                item?.tx?.alias === this.$store.state.activeWallet?.getStaticAddress('P') &&
                WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx) === 'DepositTx'
        )
    }
    get pendingTxduration() {
        if (this.pendingDepositTX) {
            let unsignedTx = new UnsignedTx()
            unsignedTx.fromBuffer(Buffer.from(this.pendingDepositTX.tx?.unsignedTx, 'hex'))
            const utx = unsignedTx.getTransaction() as DepositTx
            return parseInt(bintools.fromBufferToBN(utx.getDepositDuration()).toString())
        }
        return undefined
    }
    get pendingTxamount() {
        if (this.pendingDepositTX) {
            let unsignedTx = new UnsignedTx()
            unsignedTx.fromBuffer(Buffer.from(this.pendingDepositTX.tx?.unsignedTx, 'hex'))
            return WalletHelper.getTotalAmountFromUtxTest(unsignedTx)
        }
        return undefined
    }
    get txOwners() {
        return this.pendingDepositTX?.tx?.owners ?? []
    }

    get sigValue() {
        return this.pendingDepositTX?.tx.owners?.filter((owner) => !!owner.signature)?.length
    }
    get SignStatus(): boolean {
        let isSigned = false
        this.txOwners.forEach((owner) => {
            if (
                this.activeWallet.wallets.find((w) => w?.getAllAddressesP()?.[0] === owner.address)
            ) {
                if (owner.signature) isSigned = true
            }
        })
        return isSigned
    }
    get canExecuteMultisigTx(): boolean {
        let signers = 0
        let threshold = this.pendingDepositTX?.tx?.threshold
        this.txOwners.forEach((owner) => {
            if (owner.signature) signers++
        })
        if (threshold) return signers >= threshold
        return false
    }
    get disableSignButton(): boolean {
        let isSigned = false
        this.txOwners.forEach((owner) => {
            if (
                this.activeWallet.wallets.find((w) => w?.getAllAddressesP()?.[0] === owner.address)
            ) {
                if (owner.signature) isSigned = true
            }
        })
        return isSigned
    }
    get interestRateBase(): number {
        return 365 * 24 * 60 * 60
    }
    get currentAmount(): string {
        return bnToBig(this.amt, 9).toString()
    }
    get maxLeftToDeposit(): BN {
        if (!this.offer.totalMaxAmount.isZero()) {
            return this.offer.totalMaxAmount.sub(this.offer.depositedAmount)
        }
        let rest = this.offer.totalMaxRewardAmount.sub(this.offer.rewardedAmount)
        let amountLeftToDeposit = new BN(
            (rest.toNumber() / (this.rewardPercent / 100)) *
                (this.interestRateBase / (this.duration - this.offer.noRewardsPeriodDuration))
        )
        return amountLeftToDeposit
    }
    get amountLeftToDepositError(): string {
        if (this.maxLeftToDeposit.gte(this.amt)) return ''
        return bnToBig(this.maxLeftToDeposit, 9).toString()
    }
    get maxEndDate() {
        return this.offer.maxDuration * 1000 + new Date().getTime()
    }

    get minDuration() {
        return this.offer.minDuration * 1000
    }

    get maxDuration() {
        return this.offer.maxDuration * 1000
    }
    get rewardPercent() {
        const interestRateBase = 365 * 24 * 60 * 60
        const interestRateDenominator = 1000000 * interestRateBase

        return (
            (this.offer.interestRateNominator.toNumber() * interestRateBase * 100) /
            interestRateDenominator
        )
    }
    get ava_asset(): AvaAsset | null {
        let ava = this.$store.getters['Assets/AssetAVA']
        return ava
    }
    get nativeAssetSymbol(): string {
        return this.ava_asset?.symbol ?? ''
    }

    get duration() {
        const endDate = new Date(this.endDate).getTime()
        return Math.floor((endDate - Date.now()) / 1000)
    }

    get feeAmt(): string {
        return this.formattedAmount(ava.PChain().getTxFee())
    }
    get multupleSameAddresses(): boolean {
        const filledAddresses = this.addresses.filter((a) => a.address !== '')
        const uniqueAddresses = new Set(filledAddresses.map((a) => a.address))

        return uniqueAddresses.size !== filledAddresses.length
    }
    get isEmptyAddress(): boolean {
        let emptAddresses = this.addresses.filter((a) => !a.address)
        if (emptAddresses.length > 0) return true
        return false
    }
    get canAddWhitelisting(): boolean {
        const filledAddresses = this.addresses.filter((a) => a.address !== '')
        return !!filledAddresses.find((elem) => !this.isValidAddress(elem.address))
    }
    formattedAmount(val: BN): string {
        return `${(Number(val.toString()) / Number(ONEAVAX.toString())).toLocaleString()}`
    }
    async submitDeposit(): Promise<void> {
        if (this.depositOwner && !isValidPChainAddress(this.depositOwner)) {
            this.depositOwnerError = 'Invalid address'
            return
        } else this.depositOwnerError = ''
        const wallet: WalletType = this.$store.state.activeWallet
        try {
            const result = await WalletHelper.buildDepositTx(
                wallet,
                this.offer.id,
                this.duration,
                this.amt,
                this.$store.getters['Platform/isDepositOfferRestricted'](this.offer.id),
                this.offer.ownerAddress,
                this.depositOwner,
                this.rewardOwner
            )
            let { dispatchNotification } = this.helpers
            await this.$store.dispatch('Assets/updateUTXOs')
            await this.$store.dispatch('Platform/update')
            dispatchNotification({
                message: `Deposit Successful (TX: ${result})`,
                type: 'success',
            })
            if (!(wallet instanceof MultisigWallet)) this.cancelDeposit()
        } catch (error) {
            if (error instanceof SignatureError) {
                this.$store.dispatch('Assets/updateUTXOs')
                this.$store.dispatch('Signavault/updateTransaction').then(() => {
                    this.$store.dispatch('updateBalances')
                    this.helpers.dispatchNotification({
                        message: this.$t('notifications.transfer_success_msg'),
                        type: 'success',
                    })
                })
            } else {
                let err = error as Error
                this.helpers.dispatchNotification({
                    message: err.message,
                    type: 'error',
                })
            }
        }
    }
    async signMultisigTx() {
        const wallet = this.activeWallet
        if (!wallet || !(wallet instanceof MultisigWallet))
            return console.debug('MultiSigTx::sign: Invalid wallet')
        if (!this.pendingDepositTX) return console.debug('MultiSigTx::sign: Invalid Tx')
        try {
            await wallet.addSignatures(this.pendingDepositTX?.tx)
            this.helpers.dispatchNotification({
                message: 'Your signature saved successfully!',
                type: 'success',
            })
            this.$store.dispatch('Signavault/updateTransaction')
        } catch (e: any) {
            this.helpers.dispatchNotification({
                message: 'Your signature is not saved.',
                type: 'error',
            })
        }
    }
    async issueMultisigTx() {
        const wallet = this.activeWallet
        if (!wallet || !(wallet instanceof MultisigWallet))
            return console.log('MultiSigTx::sign: Invalid wallet')
        if (!this.pendingDepositTX) return console.log('MultiSigTx::sign: Invalid Tx')
        try {
            let txID = await wallet.issueExternal(this.pendingDepositTX?.tx)
            let { dispatchNotification } = this.helpers
            await this.$store.dispatch('Assets/updateUTXOs')
            await this.$store.dispatch('Platform/update')
            dispatchNotification({
                message: `Deposit Successful (TX: ${txID})`,
                type: 'success',
            })
            await this.$store.dispatch('Signavault/updateTransaction')
            this.cancelDeposit()
        } catch (e: any) {
            this.helpers.dispatchNotification({
                message: this.$t('notifications.execute_multisig_transaction_error'),
                type: 'error',
            })
        }
    }
    async cancelMultisigTx() {
        try {
            const wallet = this.activeWallet as MultisigWallet
            if (this.pendingDepositTX) {
                await wallet.cancelExternal(this.pendingDepositTX?.tx)
                this.helpers.dispatchNotification({
                    message: this.$t('transfer.multisig.transaction_aborted'),
                    type: 'success',
                })
                await this.$store.dispatch('Assets/updateUTXOs')
                await this.$store.dispatch('Signavault/updateTransaction')
                this.cancelDeposit()
            }
        } catch (err) {
            this.helpers.dispatchNotification({
                message: this.$t('transfer.multisig.cancel_transaction_failed'),
                type: 'error',
            })
        }
    }
    isValidAddress(address: string): boolean {
        if (!address) return true

        return isValidPChainAddress(address)
    }
    cancelDeposit() {
        this.$emit('closeDepositFundsModal')
        this.depositOwner = ''
    }
    formatDate(date: BN): string {
        const jsDate = new Date(date.toNumber() * 1000)
        return jsDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        })
    }
    formatDuration(dur: number): string {
        return formatDuration(dur)
    }
    cleanAvaxBN(val: BN): string {
        return cleanAvaxBN(val)
    }
    close() {
        this.$refs.modal.close()
    }

    open() {
        this.$refs.modal.open()
    }
    setEndDate(val: string) {
        this.endDate = val
    }
    openAbortModal() {
        this.$refs.modal_abort_signing.open()
    }
}
</script>
<style scoped lang="scss">
@use '../../../styles/abstracts/mixins';
.reward-input {
    height: 35px !important;
    width: 100%;
    input {
        width: 100%;
        padding: 6px 10px !important;
        border-radius: 6px !important;
        height: 35px !important;
    }
}
.modal__body {
    padding: 30px 22px;
    text-align: center;
    width: 600px;
    overflow-x: hidden;
}

.button--container {
    display: flex;
    width: 100%;
    justify-content: flex-end;
    gap: 16px;
}

label {
    font-weight: bolder;
}

.deposit_row {
    display: flex;
    flex-direction: column;
    border-radius: var(--border-radius-sm);
    margin-top: 16px;
    overflow: hidden;
    font-size: 14px;
    padding: 1rem;
}

form {
    display: grid;
    grid-template-columns: 1fr 340px;
    column-gap: 90px;

    .dates_form {
        margin-top: 4px;
        margin-bottom: 4px;
    }
    p {
        margin-bottom: 12px !important;
    }
}

.deposit_inputs {
    &__element {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: baseline;
    }
    span {
        text-align: start;
        width: 100%;
    }
    gap: 16px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    align-items: start;
}

.deposit_duration {
    font-size: 13px;
    padding-right: 12px;
    float: right;
}
.multi-sig__container {
    display: flex;
    flex-direction: row;
    gap: 16px;
}
.submit_box {
    margin-top: auto;
    margin-left: auto;
    display: flex;
    gap: 16px;
    flex-direction: column;
    .v-btn {
        margin-top: 14px;
        margin-right: 10px;
    }
}

.whitelisting__container {
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: 16px;
}
.addresses_container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 16px 0;
}
.address_container {
    display: flex;
    flex-direction: row;
    gap: 16px;
}
.input {
    width: 100%;
}
.button-submit {
    align-self: flex-end;
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

.plus-button {
    border: 2px solid var(--camino-success-color);
    font-size: 10px;
    margin-top: 5px;
    width: 40px !important;
    height: 40px !important;
    svg {
        color: var(--camino-success-color);
    }
}

.delete-button {
    border: 2px solid var(--camino-error-color);
    width: 40px !important;
    margin-top: 5px;
    height: 40px !important;
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

@include mixins.mobile-device {
    .delete-button.mobile {
        display: flex;
    }

    .delete-button.desktop {
        display: none;
    }
}
@include mixins.mobile-device {
    .modal__body {
        width: 100%;
    }
}
</style>
