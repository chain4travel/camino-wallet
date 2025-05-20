<template>
    <modal ref="modal" title="Undeposit" @beforeClose="beforeClose">
        <div class="claim-reward-modal">
            <div v-if="undeposit === UNDEPOSIT_STATES.INITIAL">
                <p class="text--modal">
                    {{
                        $t('earn.rewards.active_earning.unlock_amount', {
                            nativeAssetSymbol: nativeAssetSymbol,
                        })
                    }}
                </p>
                <br />
                <div
                    v-if="
                        isMultiSig &&
                        canExecuteMultisigTx &&
                        pendingUndepositTx.hasSufficientUnlocked
                    "
                >
                    <AvaxInput
                        v-model="amount"
                        :initial="amount"
                        :max="amount"
                        :readonly="true"
                    ></AvaxInput>
                </div>
                <div v-else-if="isMultiSig && !canExecuteMultisigTx">
                    <AvaxInput ref="avaxInput" :max="maxUndepositable" v-model="amt"></AvaxInput>
                </div>
                <AvaxInput ref="avaxInput" v-else :max="maxUndepositable" v-model="amt"></AvaxInput>
                <br />
                <p class="text--modal">
                    <span style="font-weight: bold">{{ formattedAmount(maxUndepositable) }}</span>
                    {{
                        $t('earn.rewards.active_earning.total_to_unlock', {
                            nativeAssetSymbol: nativeAssetSymbol,
                        })
                    }}
                </p>
                <div class="modal-buttons">
                    <CamBtn variant="transparent" @click="close()">
                        {{ $t('validator.rewards.modal_claim.cancel') }}
                    </CamBtn>
                    <CamBtn
                        variant="primary"
                        @click="confirmClaim()"
                        :disabled="amt && amt.isZero()"
                    >
                        {{ submitSentence }}
                    </CamBtn>
                </div>
                <br />
                <Alert variant="info">
                    {{
                        $t('earn.rewards.claim_modal.note_message', {
                            fee: feeAmt,
                            symbol: nativeAssetSymbol,
                        })
                    }}
                </Alert>
            </div>
            <div
                class="confirmed-claimed"
                v-else-if="undeposit === UNDEPOSIT_STATES.SIGNATURE_COLLECTED"
            >
                <br />
                <h2>{{ $t('earn.rewards.undeposit_modal.signature_collected') }}</h2>
                <br />
            </div>
        </div>
    </modal>
</template>
<script lang="ts">
import 'reflect-metadata'

import { BN } from '@c4tplatform/caminojs'
import { ONEAVAX } from '@c4tplatform/caminojs/dist/utils'
import Big from 'big.js'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { ava } from '@/AVA'
import AvaxInput from '@/components/misc/AvaxInput.vue'
import { WalletHelper } from '@/helpers/wallet_helper'
import AvaAsset from '@/js/AvaAsset'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'
import { MultisigTx as SignavaultTx } from '@/store/modules/signavault/types'

import Modal from '../../modals/Modal.vue'
import CamBtn from '@/components/CamBtn.vue'
import Alert from '@/components/Alert.vue'

enum UNDEPOSIT_STATES {
    INITIAL = 0,
    SIGNATURE_COLLECTED = 1,
}

@Component({
    components: {
        AvaxInput,
        Modal,
        CamBtn,
        Alert,
    },
})
export default class ModalUndeposit extends Vue {
    @Prop({ required: true }) depositTxID!: string
    @Prop() pendingUndepositTx!: any
    @Prop({ required: true }) maxUndepositable!: BN
    @Prop({ required: true }) amount!: BN
    @Prop() canExecuteMultisigTx!: boolean

    undeposit: number = UNDEPOSIT_STATES.INITIAL
    amt: BN = new BN(0)
    // @ts-ignore
    helpers = this.globalHelper()

    UNDEPOSIT_STATES = UNDEPOSIT_STATES

    $refs!: {
        modal: Modal
        avaxInput: AvaxInput
    }

    get submitSentence(): string {
        if (this.canExecuteMultisigTx) return 'Confirm Execute transaction'
        else return 'Undeposit'
    }

    open() {
        if (this.pendingUndepositTx) {
            this.amt = this.pendingUndepositTx.amountToUndeposit
        }
        this.$refs.modal.open()
    }

    close() {
        this.$refs.modal.close()
    }

    beforeClose() {
        this.undeposit = UNDEPOSIT_STATES.INITIAL
        this.resetAmount()
    }

    resetAmount() {
        this.amt = new BN(0)

        if (this.$refs.avaxInput) {
            this.$refs.avaxInput.reset()
        }
    }

    updateBalance(): void {
        this.$store.dispatch('updateBalances')
    }

    formattedAmount(val: BN): string {
        let big = Big(val.toString()).div(Big(ONEAVAX.toString()))
        return big.toLocaleString()
    }

    get activeWallet(): MultisigWallet {
        return this.$store.state.activeWallet
    }

    get isMultiSig(): boolean {
        return this.activeWallet.type === 'multisig'
    }

    get feeAmt(): string {
        return this.formattedAmount(ava.PChain().getTxFee())
    }

    get ava_asset(): AvaAsset | null {
        return this.$store.getters['Assets/AssetAVA']
    }

    get nativeAssetSymbol(): string {
        return this.ava_asset?.symbol ?? ''
    }

    get pendingSendMultisigTX(): SignavaultTx | undefined {
        return this.$store.getters['Signavault/transactions'].find(
            (item: any) =>
                item?.tx?.alias === this.activeWallet.getAllAddressesP()[0] &&
                WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx) === 'UnlockDepositTx'
        )
    }

    async updateRewards() {
        await this.$store.dispatch('Assets/updateUTXOs')
        await this.$store.dispatch('History/updateTransactionHistory')
        await this.$store.dispatch('Platform/updateAllDepositOffers')
        await this.$store.dispatch('Platform/updateRewards')
    }

    async confirmClaim() {
        // @ts-ignore
        let { dispatchNotification } = this.globalHelper()
        if (this.isMultiSig && this.canExecuteMultisigTx) {
            this.$emit('confirmClaim')
            return
        }
        try {
            await WalletHelper.buildUnlockDepositTx(
                this.$store.state.activeWallet,
                this.amt,
                this.depositTxID
            )
                .then(async (value) => {
                    this.updateBalance()
                    this.updateRewards()
                    if (this.isMultiSig) {
                        this.$store.dispatch('Signavault/updateTransaction').then(() => {
                            this.$emit('updateButtonStatus')
                        })
                        this.undeposit = UNDEPOSIT_STATES.SIGNATURE_COLLECTED
                    } else {
                        const currentAmount = this.formattedAmount(this.amt)
                        const currentSymbol = this.nativeAssetSymbol

                        this.helpers.dispatchNotification({
                            message: `Undeposit Successful for ${currentAmount} ${currentSymbol}`,
                            type: 'success',
                        })

                        this.undeposit = UNDEPOSIT_STATES.INITIAL

                        this.$nextTick(() => {
                            this.resetAmount()
                        })
                    }
                })
                .catch((err) => {
                    dispatchNotification({
                        message: this.$t('notifications.something_went_wrong'),
                        type: 'error',
                    })
                    console.log(err)
                })
        } catch (e) {
            console.log(e)
        }
    }
}
</script>
<style scoped lang="scss">
@use '../../../styles/abstracts/mixins';
.w {
    .col1 {
        grid-template-columns: 1fr !important;
        > * {
            grid-template-columns: 1fr !important;
        }

        * {
            grid-template-columns: 1fr !important;
        }
    }
}
.claim-reward-modal {
    padding: 30px 22px;
    text-align: center;
    width: 600px;
    overflow-x: hidden;
}

.modal-buttons {
    display: flex;
    justify-content: end;
    margin-top: 20px;
    gap: 10px;
}

.text--modal {
    @include mixins.typography-body-2;
    text-align: start;
}

@media screen and (max-width: 720px) {
    .claim-reward-modal {
        width: 350px;
    }
}
@media screen and (min-width: 720px) and (max-width: 1440px) {
    .claim-reward-modal {
        width: 475px;
    }
}
</style>
