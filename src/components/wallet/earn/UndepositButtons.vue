<template>
    <div>
        <template v-if="buttonStatus === ButtonStatus.DEFAULT">
            <CamBtn
                variant="primary"
                @click="openUndepositModal"
                :disabled="isUndepositDisabled || signavaultPendingTx"
            >
                {{ $t('earn.rewards.active_earning.undeposit') }}
            </CamBtn>
        </template>
        <template v-else-if="buttonStatus === ButtonStatus.PENDING_TRANSACTION">
            <div class="button__group">
                <CamBtn variant="negative" @click="openAbortModal">
                    {{ $t('earn.rewards.active_earning.abort') }}
                </CamBtn>
                <div v-if="canExecuteMultisigTx">
                    <CamBtn
                        variant="primary"
                        @click="openUndepositModal"
                        :disabled="!canExecuteMultisigTx"
                    >
                        {{ $t('transfer.multisig.execute_transaction') }}
                    </CamBtn>
                </div>
                <div v-else>
                    <CamBtn variant="transparent" @click="signMultisigTx" :disabled="signStatus">
                        {{
                            $t('earn.rewards.active_earning.signed', {
                                nbSigners: sigValue,
                                threshold: threshold,
                            })
                        }}
                    </CamBtn>
                </div>
            </div>
        </template>
        <template v-else-if="buttonStatus === ButtonStatus.MULTISIG_WALLET">
            <CamBtn
                v-if="!initMultisig"
                variant="primary"
                @click="initMultisigTx"
                :disabled="isUndepositDisabled || signavaultPendingTx"
            >
                {{ $t('earn.rewards.active_earning.undeposit') }}
            </CamBtn>
            <div v-else class="button__group">
                <CamBtn variant="transparent" @click="cancelInitMultisigTx">Cancel</CamBtn>
                <CamBtn
                    variant="primary"
                    @click="openUndepositModal"
                    :disabled="isUndepositDisabled || signavaultPendingTx"
                >
                    {{ $t('earn.rewards.active_earning.initiate_transaction') }}
                </CamBtn>
            </div>
        </template>
        <ModalUndeposit
            :maxUndepositable="unlockableAmount"
            ref="modal_undeposit"
            :depositTxID="reward.deposit.depositTxID"
            @confirmClaim="issueMultisigTx"
            @updateButtonStatus="updateButtonStatus"
            @close="updateButtonStatus"
            :pendingUndepositTx="pendingUndepositTx"
            :amount="pendingUndepositTx?.amountToUndeposit"
            :canExecuteMultisigTx="canExecuteMultisigTx"
        />
        <ModalAbortSigning
            ref="abort"
            title="Abort undeposit transaction"
            :modalText="$t('earn.rewards.abort_modal.message')"
            @cancelTx="cancelMultisigTx"
        />
    </div>
</template>
<script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator'
import { PlatformRewardDeposit } from '@/store/modules/platform/types'
import ModalUndeposit from './ModalUndeposit.vue'
import ModalAbortSigning from './ModalAbortSigning.vue'
import CamBtn from '@/components/CamBtn.vue'
import { BN } from '@c4tplatform/caminojs/dist'
import { MultisigTx as SignavaultTx } from '@/store/modules/signavault/types'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'
import Alert from '@/components/Alert.vue'
import { UndepositPendingTx } from '@/helpers/helper'

enum ButtonStatus {
    DEFAULT = 0,
    PENDING_TRANSACTION = 1,
    MULTISIG_WALLET = 2,
}

@Component({
    components: {
        ModalUndeposit,
        CamBtn,
        ModalAbortSigning,
        Alert,
    },
})
export default class UndepositButtons extends Vue {
    @Prop() pendingUndepositTx!: UndepositPendingTx
    @Prop() reward!: PlatformRewardDeposit

    // @ts-ignore
    helpers = this.globalHelper()

    ButtonStatus = ButtonStatus
    buttonStatus: ButtonStatus = ButtonStatus.DEFAULT
    initMultisig: boolean = false

    $refs!: {
        abort: ModalAbortSigning
        modal_undeposit: ModalUndeposit
    }

    @Watch('pendingTX')
    watchPendingTX() {
        this.updateButtonStatus()
    }

    mounted() {
        this.updateButtonStatus()
    }

    initMultisigTx() {
        this.$emit('updateDisclaimer', true)
        this.initMultisig = true
    }

    cancelInitMultisigTx() {
        this.$emit('updateDisclaimer', false)
        this.initMultisig = false
    }

    get pendingTX(): SignavaultTx | undefined {
        let pendingUndepositTx = this.pendingUndepositTx?.pendingTx as SignavaultTx
        return pendingUndepositTx
    }

    get unlockableAmount(): BN {
        return this.reward.deposit.unlockableAmount
    }

    get isUndepositDisabled() {
        return this.reward.deposit.unlockableAmount.isZero()
    }

    get activeWallet() {
        return this.$store.state.activeWallet
    }

    get sigValue() {
        return this.pendingTX?.tx.owners?.filter((owner) => !!owner.signature)?.length
    }

    get threshold() {
        return this.pendingTX?.tx.threshold
    }

    get signStatus(): boolean {
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
        let threshold = this.pendingTX?.tx?.threshold
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

    get signavaultPendingTx() {
        return this.$store.getters['Signavault/transactions'].length > 0
    }

    get txOwners() {
        return this.pendingTX?.tx?.owners ?? []
    }

    updateButtonStatus() {
        if (
            this.pendingUndepositTx?.depositTxIDs?.find(
                (tx: string) => tx === this.reward.deposit.depositTxID
            )
        ) {
            this.buttonStatus = ButtonStatus.PENDING_TRANSACTION
        } else if (this.activeWallet.type === 'multisig' && !this.pendingTX) {
            this.buttonStatus = ButtonStatus.MULTISIG_WALLET
        } else {
            this.buttonStatus = ButtonStatus.DEFAULT
        }
    }

    async signMultisigTx() {
        const wallet = this.activeWallet
        if (!wallet || !(wallet instanceof MultisigWallet))
            return console.debug('MultiSigTx::sign: Invalid wallet')
        if (!this.pendingTX) return console.debug('MultiSigTx::sign: Invalid Tx')
        try {
            await wallet.addSignatures(this.pendingTX?.tx)
            this.helpers.dispatchNotification({
                message: 'Your signature has been saved successfully!',
                type: 'success',
            })
            this.$store.dispatch('Signavault/updateTransaction')
            this.updateButtonStatus()
        } catch (e: any) {
            this.helpers.dispatchNotification({
                message: 'Your signature has not been saved.',
                type: 'error',
            })
        }
    }
    async issueMultisigTx() {
        const wallet = this.activeWallet
        if (!wallet || !(wallet instanceof MultisigWallet))
            return console.log('MultiSigTx::sign: Invalid wallet')
        if (!this.pendingTX) return console.log('MultiSigTx::sign: Invalid Tx')
        try {
            let txID = await wallet.issueExternal(this.pendingTX?.tx)
            let { dispatchNotification } = this.helpers
            await this.$store.dispatch('Assets/updateUTXOs')
            await this.$store.dispatch('Platform/update')
            dispatchNotification({
                message: `Undeposit Successful (TX: ${txID})`,
                type: 'success',
            })
            await this.$store.dispatch('Signavault/updateTransaction')
            this.updateButtonStatus()
            this.closeUndepositModal()
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
            if (this.pendingTX) {
                await wallet.cancelExternal(this.pendingTX?.tx)
                this.helpers.dispatchNotification({
                    message: this.$t('transfer.multisig.transaction_aborted'),
                    type: 'success',
                })
                await this.$store.dispatch('Assets/updateUTXOs')
                await this.$store.dispatch('Signavault/updateTransaction')
                this.updateButtonStatus()
            }
        } catch (err) {
            console.error('Error canceling multisig transaction:', err)
            this.helpers.dispatchNotification({
                message: this.$t('transfer.multisig.cancel_transaction_failed'),
                type: 'error',
            })
        }
    }

    openUndepositModal() {
        this.$refs.modal_undeposit.open()
    }

    closeUndepositModal() {
        if (this.initMultisig) {
            this.initMultisig = false
            this.$emit('updateDisclaimer', false)
        }
        this.$refs.modal_undeposit.close()
    }

    openAbortModal() {
        this.$refs.abort.open()
    }
}
</script>

<style scoped lang="scss">
@use '../../../styles/abstracts/mixins';

.button__group {
    display: flex;
    margin-left: auto;
    gap: 0.4rem;
    justify-content: end;
}
</style>
