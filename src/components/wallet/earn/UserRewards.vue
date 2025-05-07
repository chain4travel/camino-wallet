<template>
    <div v-if="hasPendingRewards || hasRewards">
        <TreasuryRewardCard
            v-if="firstTreasuryReward && !firstTreasuryReward.amountToClaim.isZero()"
            class="reward_card"
            :key="'reward_TreasuryReward'"
            :reward="firstTreasuryReward"
            :pendingDepositClaimStatus="pendingDepositClaimStatus"
        />
        <div class="user_offers">
            <DepositRewardCard
                v-for="(reward, index) in platformRewards.depositRewards"
                :key="'reward_' + index"
                :reward="reward"
                class="reward_card"
                @updatePendingDepositClaim="updatePendingDepositClaim"
                :pendingUndepositTx="pendingUndepositTx"
            />
        </div>
    </div>
    <div v-else class="empty">No Active Earning</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

import DepositRewardCard from '@/components/wallet/earn/DepositRewardCard.vue'
import { PlatformRewards } from '@/store/modules/platform/types'
import TreasuryRewardCard from './TreasuryRewardCard.vue'
import { MultisigTx as SignavaultTx } from '@/store/modules/signavault/types'
import { WalletHelper } from '@/helpers/wallet_helper'
import { UnlockDepositTx, UnsignedTx } from '@c4tplatform/caminojs/dist/apis/platformvm'
import { BN, Buffer } from '@c4tplatform/caminojs/dist'
import { ava, bintools } from '@/AVA'
import { WalletType } from '@/js/wallets/types'
import { bnToBig, UndepositPendingTx } from '@/helpers/helper'

@Component({
    components: {
        DepositRewardCard,
        TreasuryRewardCard,
    },
})
export default class UserRewards extends Vue {
    pendingDepositClaimStatus = false

    mounted() {
        this.updateExpiredDepositRewards()
    }

    updatePendingDepositClaim(status: boolean) {
        this.pendingDepositClaimStatus = status
    }

    updateExpiredDepositRewards() {
        const { depositRewards } = this.$store.state.Platform.rewards
        depositRewards.forEach((reward: any) => {
            this.$store.getters['Platform/updateExpiredDepositRewards'](
                reward.deposit.depositOfferID,
                reward.deposit.start.toNumber()
            )
        })
    }

    get platformRewards(): PlatformRewards {
        return this.$store.state.Platform.rewards
    }

    get hasRewards(): boolean {
        return this.platformRewards.depositRewards.length > 0
    }

    get hasPendingRewards(): boolean {
        return this.platformRewards.treasuryRewards.length > 0
    }

    get firstTreasuryReward() {
        return this.platformRewards.treasuryRewards[0] ?? null
    }

    get activeWallet(): WalletType {
        return this.$store.state.activeWallet
    }

    get pendingUndepositTx(): UndepositPendingTx | null {
        const pendingTx = this.$store.getters['Signavault/transactions'].find(
            (item: SignavaultTx) =>
                item?.tx?.alias === this.activeWallet.getStaticAddress('P') &&
                WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx) === 'UnlockDepositTx'
        )
        if (!pendingTx?.tx?.unsignedTx) {
            return null
        }

        const unsignedTx = new UnsignedTx()
        unsignedTx.fromBuffer(Buffer.from(pendingTx.tx.unsignedTx, 'hex'))

        const tx = unsignedTx.getTransaction() as UnlockDepositTx

        // Track total consumed and produced locked amounts
        let totalConsumedLocked = new BN(0)
        let totalProducedLocked = new BN(0)

        // Track total unlocked amount
        let totalUnlockedAmount = new BN(0)

        // Extract deposit transaction IDs
        const depositTxIDs: string[] = []

        // Process inputs to find consumed locked amounts and deposit txIDs
        const ins = tx.getIns()
        for (let i = 0; i < ins.length; i++) {
            const input = ins[i]
            const baseInput = input.getInput()

            if (baseInput && baseInput._typeName === 'LockedIn') {
                // Get consumed locked amount
                const consumedLocked = baseInput.getInput().amount
                if (Buffer.isBuffer(consumedLocked)) {
                    const bnAmount = bintools.fromBufferToBN(consumedLocked)
                    totalConsumedLocked = totalConsumedLocked.add(bnAmount)
                }

                // Extract deposit txID
                const lockedIn = baseInput as any
                if (lockedIn.ids && lockedIn.ids.depositTxID && lockedIn.ids.depositTxID.txid) {
                    const depositTxIDBuffer = lockedIn.ids.depositTxID.txid
                    const depositTxID = bintools.cb58Encode(depositTxIDBuffer)
                    if (!depositTxIDs.includes(depositTxID)) {
                        depositTxIDs.push(depositTxID)
                    }
                }
            }
        }

        // Process outputs to find produced locked amounts and unlocked outputs
        const outs = tx.getOuts()
        for (let i = 0; i < outs.length; i++) {
            const output = outs[i]
            const outputObj = output.getOutput()

            if (outputObj && outputObj._typeName === 'LockedOut') {
                // Handle locked outputs
                const producedLocked = outputObj.getOutput().amount
                if (Buffer.isBuffer(producedLocked)) {
                    const bnAmount = bintools.fromBufferToBN(producedLocked)
                    totalProducedLocked = totalProducedLocked.add(bnAmount)
                }
            } else if (outputObj && 'amount' in outputObj) {
                // Handle unlocked outputs
                const amountBuffer = outputObj.amount
                if (Buffer.isBuffer(amountBuffer)) {
                    const amount = bintools.fromBufferToBN(amountBuffer)
                    totalUnlockedAmount = totalUnlockedAmount.add(amount)
                }
            }
        }

        // Calculate amount to undeposit (consumedLocked - producedLocked)
        const amountToUndeposit = totalConsumedLocked.sub(totalProducedLocked)

        // Get transaction fee
        const txFee = ava.PChain().getTxFee()

        // This ensures total unlocked amount is at least (amountToUndeposit - txFee)
        const minimumExpectedUnlocked = amountToUndeposit.sub(txFee)
        const hasSufficientUnlocked = totalUnlockedAmount.gte(minimumExpectedUnlocked)

        return {
            amountToUndeposit: amountToUndeposit,
            depositTxIDs,
            pendingTx,
            hasSufficientUnlocked,
        }
    }

    get nativeAssetSymbol(): string {
        return this.$store.getters['Assets/AssetAVA']?.symbol ?? ''
    }
}
</script>

<style scoped lang="scss">
@use '../../../styles/abstracts/mixins';

.user_offers {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-gap: 1rem;
}

.reward_card {
    margin-bottom: 1rem;
}

.empty {
    padding-bottom: 5vh;
    text-align: center;
    color: var(--primary-color-light);
}

@include mixins.medium-device {
    .user_offers {
        grid-template-columns: 1fr;
    }
}

@include mixins.mobile-device {
    .user_offers {
        grid-template-columns: 1fr;
    }
}
</style>
