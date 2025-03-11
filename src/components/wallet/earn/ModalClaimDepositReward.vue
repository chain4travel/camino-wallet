<template>
    <modal ref="modal" title="Claim Reward" @beforeClose="beforeClose">
        <div class="claim-reward-modal">
            <div v-if="claimed === 0">
                <div v-if="canExecuteMultisigTx">
                    <AvaxInput
                        v-if="pendingSendMultisigTX"
                        v-model="confiremedClaimedAmount"
                        :max="confiremedClaimedAmount"
                        :initial="confiremedClaimedAmount"
                        :readonly="true"
                    ></AvaxInput>
                    <AvaxInput v-else v-model="amt" :max="amount" :initial="amount"></AvaxInput>
                    <br />
                </div>
                <div v-if="!canExecuteMultisigTx">
                    <AvaxInput v-model="amt" :max="amount" :initial="amount"></AvaxInput>
                    <br />
                    <p class="text-modal">
                        {{
                            $t('earn.rewards.claim_modal.note_message', {
                                fee: feeAmt,
                                symbol: nativeAssetSymbol,
                            })
                        }}
                    </p>
                </div>
                <Alert variant="warning" v-if="isAmountLessThanTxFee">
                    {{ $t('earn.rewards.claim_modal.alert_info_message') }}
                </Alert>
                <div class="modal-buttons">
                    <CamBtn variant="transparent" @click="close()">
                        {{ $t('earn.rewards.claim_modal.cancel') }}
                    </CamBtn>
                    <CamBtn
                        variant="primary"
                        @click="confirmClaim()"
                        :disabled="disableClaimButton"
                    >
                        {{ $t('earn.rewards.claim_modal.confirm') }}
                    </CamBtn>
                </div>
            </div>
            <div class="confirmed-claimed" v-else-if="claimed === 1">
                <br />
                <h2>
                    {{
                        $t('earn.rewards.claim_modal.confirmation_message', {
                            amount: cleanAvaxBN(confiremedClaimedAmount),
                            symbol: nativeAssetSymbol,
                        })
                    }}
                </h2>
                <br />
            </div>
            <div class="confirmed-claimed" v-else>
                <br />
                <h2>{{ $t('earn.rewards.claim_modal.signature_collected') }}</h2>
                <br />
            </div>
        </div>
    </modal>
</template>
<script lang="ts">
import { ava, bintools } from '@/AVA'
import AvaxInput from '@/components/misc/AvaxInput.vue'
import { RewardOwner } from '@/components/misc/ValidatorList/types'
import { WalletHelper } from '@/helpers/wallet_helper'
import AvaAsset from '@/js/AvaAsset'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'
import { MultisigTx as SignavaultTx } from '@/store/modules/signavault/types'
import { BN, Buffer } from '@c4tplatform/caminojs'
import { UnsignedTx } from '@c4tplatform/caminojs/dist/apis/platformvm'
import { ClaimTx } from '@c4tplatform/caminojs/dist/apis/platformvm/claimtx'
import { OutputOwners } from '@c4tplatform/caminojs/dist/common'
import { ONEAVAX } from '@c4tplatform/caminojs/dist/utils'
import Big from 'big.js'
import 'reflect-metadata'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import Modal from '../../modals/Modal.vue'
import CamBtn from '@/components/CamBtn.vue'
import { cleanAvaxBN } from '@/helpers/helper'
import { ZeroBN } from '@/constants'
import Alert from '@/components/Alert.vue'

@Component({
    components: {
        AvaxInput,
        Modal,
        CamBtn,
        Alert,
    },
})
export default class ModalClaimDepositReward extends Vue {
    @Prop({ required: true }) depositTxID!: string
    @Prop({ required: true }) amount!: BN
    @Prop({ required: true }) rewardOwner!: RewardOwner
    @Prop() validatorClaim!: boolean
    @Prop() canExecuteMultisigTx!: boolean

    claimed: number = 0 // 0:false, 1:true, 2:pending
    confiremedClaimedAmount: BN = new BN(0)
    amt: BN = this.amount

    @Watch('amount')
    onAmountChange() {
        this.amt = this.amount
    }

    // @ts-ignore
    helpers = this.globalHelper()

    $refs!: {
        modal: Modal
    }

    open() {
        this.$refs.modal.open()
        this.updateMultisigTxDetails()
    }

    close() {
        this.$refs.modal.close()
    }

    beforeClose() {
        this.confiremedClaimedAmount = new BN(0)
        this.$emit('beforeCloseModal', this.claimed)
        this.claimed = 0
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

    get feeAmt(): string {
        return this.cleanAvaxBN(ava.PChain().getTxFee())
    }

    get isAmountLessThanTxFee(): boolean {
        return this.amt.lt(ava.PChain().getTxFee())
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
                WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx) === 'ClaimTx'
        )
    }

    get disableClaimButton(): boolean {
        return this.amt.eq(ZeroBN)
    }

    async updateRewards() {
        await this.$store.dispatch('Assets/updateUTXOs')
        await this.$store.dispatch('History/updateTransactionHistory')
        await this.$store.dispatch('Platform/updateAllDepositOffers')
        await this.$store.dispatch('Platform/updateRewards')
    }

    async confirmClaim() {
        const wallet = this.$store.state.activeWallet
        // @ts-ignore
        let { dispatchNotification } = this.globalHelper()
        const hrp = ava.getHRP()
        const rewardOwner = new OutputOwners(
            this.rewardOwner.addresses.map((a) => bintools.stringToAddress(a, hrp)),
            this.rewardOwner.locktime,
            this.rewardOwner.threshold
        )

        if (!this.pendingSendMultisigTX) {
            WalletHelper.buildDepositClaimTx(
                wallet,
                this.depositTxID,
                rewardOwner,
                this.amt,
                this.validatorClaim
            )
                .then(async (value) => {
                    if (!value) {
                        // multisg flow
                        this.$store.dispatch('Signavault/updateTransaction')
                        dispatchNotification({
                            message: this.$t('notifications.transfer_success_msg'),
                            type: 'success',
                        })
                        this.claimed = 2
                        return this.updateMultisigTxDetails()
                    }

                    this.confiremedClaimedAmount = this.amt
                    this.updateBalance()
                    this.updateMultisigTxDetails()
                    this.updateRewards()
                    this.helpers.dispatchNotification({
                        message: `Claim Successful (TX: ${value})`,
                        type: 'success',
                    })

                    this.claimed = 1
                })
                .catch((err) => {
                    dispatchNotification({
                        message: this.$t('notifications.something_went_wrong'),
                        type: 'error',
                    })
                    this.confiremedClaimedAmount = new BN(0)
                    this.claimed = 0
                })
        } else {
            this.issueMultisigTx()
            this.updateBalance()
        }
        this.$emit('updatePendingDepositClaim', false)
    }

    async issueMultisigTx() {
        const wallet = this.activeWallet
        if (!wallet || !(wallet instanceof MultisigWallet))
            return console.error('MultiSigTx::sign: Invalid wallet')
        if (!this.pendingSendMultisigTX) return console.error('MultiSigTx::sign: Invalid Tx')
        try {
            await this.updateMultisigTxDetails()
            await wallet.issueExternal(this.pendingSendMultisigTX?.tx)
            this.helpers.dispatchNotification({
                message: 'Your Transaction sent successfully.',
                type: 'success',
            })
            this.updateBalance()
            this.updateRewards()
            this.$store.dispatch('Signavault/updateTransaction')
            this.claimed = 1
        } catch (e: any) {
            console.error('MultiSigTx::sign: Error', e)
            this.helpers.dispatchNotification({
                message: this.$t('notifications.execute_multisig_transaction_error'),
                type: 'error',
            })
            throw e
        }
    }

    async updateMultisigTxDetails() {
        if (this.pendingSendMultisigTX) {
            let unsignedTx = new UnsignedTx()
            unsignedTx.fromBuffer(Buffer.from(this.pendingSendMultisigTX.tx?.unsignedTx, 'hex'))
            const utx = unsignedTx.getTransaction() as ClaimTx
            const claimAmounts = utx.getClaimAmounts()

            const amount = claimAmounts[0].getAmount()
            this.confiremedClaimedAmount = new BN(amount)
        } else this.confiremedClaimedAmount = this.amt
    }

    cleanAvaxBN(val: BN): string {
        return cleanAvaxBN(val)
    }
}
</script>
<style scoped lang="scss">
.claim-reward-modal {
    padding: 30px 22px;
    text-align: center;
    width: 600px;
    overflow-x: hidden;
}

.modal-buttons {
    display: flex;
    justify-content: center;
    margin-top: 20px;
    gap: 10px;
}

.text-modal {
    color: var(--warning);
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
