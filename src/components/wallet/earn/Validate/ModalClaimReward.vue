<template>
    <modal ref="modal" title="Claim Reward" @beforeClose="beforeClose">
        <div class="modal-claim-reward-div">
            <div v-if="!claimed">
                <div>
                    <AvaxInput v-model="claimAmount" :max="amount" :initial="amount"></AvaxInput>
                    <br />
                    <Alert variant="warning">
                        {{
                            $t('validator.rewards.modal_claim.kindy_be_aware', {
                                fee: feeTx,
                                symbol: nativeAssetSymbol,
                            })
                        }}
                    </Alert>
                    <br />
                </div>
                <div class="modal-buttons">
                    <CamBtn variant="transparent" @click="close()">
                        {{ $t('validator.rewards.modal_claim.cancel') }}
                    </CamBtn>
                    <CamBtn
                        variant="primary"
                        @click="confirmClaim()"
                        :disabled="claimAmount.isZero() || notRewardOwner()"
                    >
                        {{ $t('validator.rewards.modal_claim.claim') }}
                    </CamBtn>
                </div>
            </div>
            <div class="confirmed-claimed" v-else>
                <br />
                <div v-if="!isMultisignTx">
                    <h2>
                        {{
                            $t('validator.rewards.modal_claim.confirmed_claimed', {
                                amount: confirmedClaimedAmountText,
                                symbol: symbol,
                            })
                        }}
                    </h2>
                </div>
                <br />
            </div>
        </div>
    </modal>
</template>
<script lang="ts">
import 'reflect-metadata'
import { Vue, Component, Prop, Watch } from 'vue-property-decorator'
import Modal from '../../../modals/Modal.vue'
import { BN } from '@c4tplatform/caminojs'
import { WalletHelper } from '../../../../helpers/wallet_helper'
import { ava } from '@/AVA'
import AvaxInput from '@/components/misc/AvaxInput.vue'
import { bnToBigAvaxX } from '@/helpers/helper'
import CamBtn from '@/components/CamBtn.vue'
import Alert from '@/components/Alert.vue'

@Component({
    components: {
        Modal,
        AvaxInput,
        CamBtn,
        Alert,
    },
})
export default class ModalClaimReward extends Vue {
    @Prop() amountText!: string
    @Prop() symbol!: string
    @Prop() amount!: BN
    @Prop() rewardOwner!: string
    @Prop() pChainddress!: string
    @Prop() isMultisignTx!: boolean

    claimed: boolean = false
    confirmedClaimedAmountText: string = ''
    claimAmount: BN = this.amount

    @Watch('amount')
    onAmountChange() {
        this.claimAmount = this.amount
    }

    open() {
        // @ts-ignore
        this.$refs.modal.open()
    }

    close() {
        // @ts-ignore
        this.$refs.modal.close()
    }

    beforeClose() {
        this.confirmedClaimedAmountText = ''
        this.$emit('beforeCloseModal', this.claimed)
        this.claimed = false
    }

    get addressPVM() {
        let wallet = this.$store.state.activeWallet
        if (!wallet) {
            return '-'
        }

        return wallet.getCurrentAddressPlatform()
    }

    notRewardOwner() {
        return this.rewardOwner !== this.addressPVM
    }

    async confirmClaim() {
        // @ts-ignore
        let { dispatchNotification } = this.globalHelper()
        try {
            let txClaim = this.$store.getters['Signavault/transactions'].find(
                (item: any) =>
                    item?.tx?.alias === this.pChainddress &&
                    WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx) === 'ClaimTx'
            )

            await WalletHelper.buildClaimTx(
                this.pChainddress,
                this.claimAmount,
                this.$store.state.activeWallet,
                this.rewardOwner
            )

            dispatchNotification({
                message: this.$t('notifications.multisig_transaction_saved', {
                    txId: txClaim?.tx?.id,
                }),
                type: 'success',
            })

            if (this.isMultisignTx) {
                this.claimed = true
                this.close()
                this.$emit('beforeCloseModal', false)
            } else {
                this.confirmedClaimedAmountText = bnToBigAvaxX(this.claimAmount).toString()
                this.claimed = true
            }
        } catch (e) {
            console.error(e)
            if (this.isMultisignTx) {
                this.close()
                dispatchNotification({
                    message: this.$t('notifications.execute_multisig_transaction_error', {
                        error: e ?? '',
                    }),
                    type: 'error',
                })
                this.$emit('beforeCloseModal', false)
            } else {
                const error = e instanceof Error ? e : new Error('Unknown error')
                const errorMessage = error?.message
                dispatchNotification({
                    message: errorMessage,
                    type: 'error',
                })
                this.claimed = false
            }
        }
    }

    get feeTx() {
        return bnToBigAvaxX(ava.PChain().getTxFee())
    }

    get nativeAssetSymbol(): string {
        return this.$store.getters['Assets/AssetAVA']?.symbol ?? ''
    }
}
</script>
<style scoped lang="scss">
.modal-buttons {
    display: flex;
    justify-content: center;
    margin-top: 20px;
    gap: 10px;
}

.modal-claim-reward-div {
    padding: 30px 22px;
    text-align: center;
    width: 600px;
    overflow-x: hidden;
}

@media screen and (max-width: 720px) {
    .modal-claim-reward-div {
        width: 350px;
        min-width: fit-content;
    }
}

@media screen and (min-width: 720px) and (max-width: 1440px) {
    .modal-claim-reward-div {
        width: 475px;
    }
}

.confirmed-claimed {
    top: 50%;
    left: 50%;
}
</style>
