<template>
    <modal ref="modal" title="Claim Reward" @beforeClose="beforeClose">
        <div class="claim-reward-modal">
            <div v-if="!claimed">
                <div>
                    <AvaxInput :max="amount" :initial="amount" v-model="amt"></AvaxInput>
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
                <div class="modal-buttons">
                    <v-btn depressed class="button_secondary btn-claim" @click="confirmClaim()">
                        {{ $t('earn.rewards.claim_modal.confirm') }}
                    </v-btn>
                    <v-btn depressed class="button_primary" @click="close()">
                        {{ $t('earn.rewards.claim_modal.cancel') }}
                    </v-btn>
                </div>
            </div>
            <div class="confirmed-claimed" v-else>
                <br />
                <h2>
                    {{
                        $t('earn.rewards.claim_modal.confirmation_message', {
                            amount: confirmedClaimedAmount,
                            symbol: nativeAssetSymbol,
                        })
                    }}
                </h2>
                <br />
            </div>
        </div>
    </modal>
</template>
<script lang="ts">
import Big from 'big.js'
import 'reflect-metadata'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { ava, bintools } from '@/AVA'
import AvaxInput from '@/components/misc/AvaxInput.vue'
import { WalletHelper } from '@/helpers/wallet_helper'
import AvaAsset from '@/js/AvaAsset'
import { WalletType } from '@/js/wallets/types'
import { RewardOwner } from '@/store/modules/platform/types'
import Modal from './Modal.vue'

import { BN } from '@c4tplatform/caminojs/dist'
import { OutputOwners, SignatureError } from '@c4tplatform/caminojs/dist/common'
import { ONEAVAX } from '@c4tplatform/caminojs/dist/utils'

@Component({
    components: {
        AvaxInput,
        Modal,
    },
})
export default class ModalClaimReward extends Vue {
    @Prop() depositTxID?: string
    @Prop() amount!: BN
    @Prop() rewardOwner!: RewardOwner
    @Prop() validatorClaim!: boolean

    claimed: boolean = false
    confirmedClaimedAmount: string = ''
    amt: BN = this.amount

    $refs!: {
        modal: Modal
    }
    open() {
        this.$refs.modal.open()
    }
    close() {
        this.$refs.modal.close()
    }

    beforeClose() {
        this.confirmedClaimedAmount = ''
        this.$emit('beforeCloseModal', this.claimed)
        this.claimed = false
    }

    formattedAmount(val: BN): string {
        let big = Big(val.toString()).div(Big(ONEAVAX.toString()))
        return big.toLocaleString()
    }

    get feeAmt(): string {
        return this.formattedAmount(ava.PChain().getTxFee())
    }

    get claimableAmount(): string {
        return this.formattedAmount(this.amount)
    }

    get ava_asset(): AvaAsset | null {
        let ava = this.$store.getters['Assets/AssetAVA']
        return ava
    }

    get nativeAssetSymbol(): string {
        return this.ava_asset?.symbol ?? ''
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
        const wallet: WalletType = this.$store.state.activeWallet
        const hrp = ava.getHRP()
        const rewardOwner = new OutputOwners(
            this.rewardOwner.addresses.map((a) => bintools.stringToAddress(a, hrp)),
            this.rewardOwner.locktime,
            this.rewardOwner.threshold
        )

        try {
            const result = await WalletHelper.buildDepositClaimTx(
                wallet,
                this.depositTxID as string,
                rewardOwner,
                this.amt,
                this.validatorClaim
            )
            this.$store.dispatch('updateTransaction', {
                withDeposit: true,
                msgType: 'success',
                msgTitle: 'Transaction',
                msgText: `Claim Successful (TX: ${result})`,
            })
            this.updateRewards()
        } catch (error) {
            if (error instanceof SignatureError) {
                this.$store.dispatch('updateTransaction', {
                    onlyMultisig: true,
                    msgType: 'success',
                    msgTitle: 'Multisignature',
                    msgText: 'Transaction Recorded.',
                })
            } else {
                const err = error instanceof Error ? error : new Error('Unknown error')
                const errorMessage = err?.message
                dispatchNotification({
                    message: errorMessage,
                    type: 'error',
                })
                console.error(error)
                this.claimed = false
                return
            }
        }
        this.confirmedClaimedAmount = this.formattedAmount(this.amt)
        this.claimed = true
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
