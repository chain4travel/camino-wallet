<template>
    <CamCard :title="title">
        <template v-if="isOffer">
            <div class="progress" v-if="isOffer">
                <label>{{ $t('earn.rewards.offer.pool_size') }}:</label>
                <span>
                    <span class="success" :style="'width:' + progress"></span>
                </span>
                {{ progressText }}
            </div>
            <div class="offer_detail" v-if="isOffer">
                <div class="offer_detail_left">
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.offer.pool_start') }}:</label>
                        <p class="reward">{{ formatDate(offer.start) }}</p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.offer.pool_end') }}:</label>
                        <p class="reward">{{ formatDate(offer.end) }}</p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.offer.min_deposit') }}:</label>
                        <p class="reward">{{ cleanAvaxBN(offer.minAmount) }} CAM</p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.offer.reward') }}:</label>
                        <p class="reward">{{ rewardPercent }} %</p>
                    </div>
                </div>
                <div class="offer_detail_right">
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.offer.min_duration') }}:</label>
                        <p class="reward">
                            {{ formatDuration(offer.minDuration) }}
                        </p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.offer.max_duration') }}:</label>
                        <p class="reward">
                            {{ formatDuration(offer.maxDuration) }}
                        </p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.offer.unlock_duration') }}:</label>
                        <p class="reward">
                            {{ formatDuration(offer.unlockPeriodDuration) }}
                        </p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.offer.no_reward_duration') }}:</label>
                        <p class="reward">
                            {{ formatDuration(offer.noRewardsPeriodDuration) }}
                        </p>
                    </div>
                </div>
            </div>
        </template>
        <template v-else-if="isReward">
            <div class="offer_detail">
                <div class="offer_detail_left">
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.active_earning.deposit_start') }}:</label>
                        <p class="reward">{{ startDate }}</p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.active_earning.deposit_end') }}:</label>
                        <p class="reward">{{ endDate }}</p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.offer.min_deposit') }}:</label>
                        <p class="reward">{{ cleanAvaxBN(minLock) }} {{ nativeAssetSymbol }}</p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.offer.reward') }}:</label>
                        <p class="reward">{{ rewardPercent }} %</p>
                    </div>
                </div>
                <div class="offer_detail_right">
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.active_earning.deposited_amount') }}:</label>
                        <p class="reward">
                            {{ cleanAvaxBN(reward.deposit.amount) }} {{ nativeAssetSymbol }}
                        </p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.active_earning.pending_reward') }}:</label>
                        <p class="reward">
                            {{ cleanAvaxBN(reward.amountToClaim) }} {{ nativeAssetSymbol }}
                        </p>
                    </div>
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.active_earning.already_claimed') }}:</label>
                        <p class="reward">
                            {{ cleanAvaxBN(reward.deposit.claimedRewardAmount) }}
                            {{ nativeAssetSymbol }}
                        </p>
                    </div>
                    <div class="reward_row" v-if="pendingSendMultisigTX">
                        <label>{{ $t('earn.rewards.active_earning.initiated_claim') }}:</label>
                        <p class="reward">
                            {{ updateMultisigTxDetails() }} {{ nativeAssetSymbol }}
                        </p>
                    </div>
                </div>
            </div>
        </template>
        <template v-else-if="isTreasuryRewards">
            <div class="offer_detail">
                <div class="offer_detail_left">
                    <p>
                        {{ $t('earn.rewards.pending_rewards.description') }}
                    </p>
                </div>
                <div class="offer_detail_right">
                    <div class="reward_row">
                        <label>{{ $t('earn.rewards.pending_rewards.pending_reward') }}:</label>
                        <p class="reward">
                            {{ cleanAvaxBN(treasuryRewards.amountToClaim) }} {{ nativeAssetSymbol }}
                        </p>
                    </div>
                </div>
            </div>
        </template>
        <slot></slot>
    </CamCard>
</template>
<script lang="ts">
import { ZeroBN } from '@/constants'
import { cleanAvaxBN, formatDuration } from '@/helpers/helper'
import { WalletHelper } from '@/helpers/wallet_helper'
import AvaAsset from '@/js/AvaAsset'
import { WalletType } from '@/js/wallets/types'
import { PlatformRewardDeposit, PlatformRewardTreasury } from '@/store/modules/platform/types'
import { MultisigTx as SignavaultTx } from '@/store/modules/signavault/types'
import { BN, Buffer } from '@c4tplatform/caminojs/dist'
import { ClaimTx, UnsignedTx } from '@c4tplatform/caminojs/dist/apis/platformvm'
import { DepositOffer } from '@c4tplatform/caminojs/dist/apis/platformvm/interfaces'
import { Component, Prop, Vue } from 'vue-property-decorator'
import CamCard from './CamCard.vue'

@Component({
    components: { CamCard },
})
export default class CamOfferCard extends Vue {
    @Prop() readonly title!: string
    @Prop() readonly type!: 'offer' | 'reward' | 'treasuryRewards'
    @Prop() readonly offer!: DepositOffer
    @Prop() readonly reward!: PlatformRewardDeposit
    @Prop() readonly treasuryRewards!: PlatformRewardTreasury

    get isOffer() {
        return this.type === 'offer'
    }

    get isReward() {
        return this.type === 'reward'
    }

    get isTreasuryRewards() {
        return this.type === 'treasuryRewards'
    }

    get activeWallet(): WalletType {
        return this.$store.state.activeWallet
    }

    get pendingSendMultisigTX(): SignavaultTx | undefined {
        return this.$store.getters['Signavault/transactions'].find(
            (item: any) =>
                item?.tx?.alias === this.activeWallet.getStaticAddress('P') &&
                WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx) === 'ClaimTx'
        )
    }

    get ava_asset(): AvaAsset | null {
        let ava = this.$store.getters['Assets/AssetAVA']
        return ava
    }

    get rewardPercent() {
        if (this.type === 'offer') {
            const interestRateBase = 365 * 24 * 60 * 60
            const interestRateDenominator = 1000000 * interestRateBase

            return (
                (this.offer.interestRateNominator.toNumber() * interestRateBase * 100) /
                interestRateDenominator
            )
        } else {
            if (!this.depositOffer) return 0

            const interestRateBase = 365 * 24 * 60 * 60
            const interestRateDenominator = 1000000 * interestRateBase

            return (
                (this.depositOffer.interestRateNominator.toNumber() * interestRateBase * 100) /
                interestRateDenominator
            )
        }
    }

    get nativeAssetSymbol(): string {
        return this.ava_asset?.symbol ?? ''
    }

    get amountLimit(): { nominator: BN; amount: BN } {
        return !this.offer.totalMaxAmount.isZero()
            ? { nominator: this.offer.depositedAmount, amount: this.offer.totalMaxAmount }
            : { nominator: this.offer.rewardedAmount, amount: this.offer.totalMaxRewardAmount }
    }

    get progress(): string {
        const amt = this.amountLimit
        const scaledResult = amt.nominator.mul(new BN(100)).mul(new BN(100))
        const preciseResult = scaledResult.div(amt.amount)
        return amt.amount.isZero() ? '0px' : Number(preciseResult.toString()) / 100 + '%'
    }

    get progressText(): string {
        const amt = this.amountLimit
        return amt.amount.isZero()
            ? 'No Limit'
            : this.progress + '(' + cleanAvaxBN(amt.amount) + this.nativeAssetSymbol + ')'
    }

    get depositOffer(): DepositOffer | undefined {
        return this.$store.getters['Platform/depositOffer'](this.reward.deposit.depositOfferID)
    }

    get startDate() {
        const startDate = new Date(parseInt(this.reward.deposit.start.toString()) * 1000)

        return startDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        })
    }

    get endDate() {
        const endDate = new Date(
            (this.reward.deposit.start.toNumber() + this.reward.deposit.duration) * 1000
        )

        return endDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        })
    }

    get minLock() {
        return this.depositOffer?.minAmount ?? ZeroBN
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

    cleanAvaxBN(val: BN): string {
        return cleanAvaxBN(val)
    }

    formatDuration(dur: number): string {
        return formatDuration(dur)
    }

    updateMultisigTxDetails() {
        if (this.pendingSendMultisigTX) {
            let unsignedTx = new UnsignedTx()
            unsignedTx.fromBuffer(Buffer.from(this.pendingSendMultisigTX.tx?.unsignedTx, 'hex'))
            const utx = unsignedTx.getTransaction() as ClaimTx
            const claimAmounts = utx.getClaimAmounts()

            const amount = claimAmounts[0].getAmount()
            return cleanAvaxBN(new BN(amount))
        }
        return new BN(0)
    }
}
</script>

<style scoped lang="scss">
@use '../styles/abstracts/mixins';

.button--container {
    display: flex;
    width: 100%;
    justify-content: flex-end;
}

.progress {
    grid-column: span 2;
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-gap: 1rem;
    margin-bottom: 1rem;
    > span {
        margin-top: auto;
        margin-bottom: auto;
        height: 4px;
        background-color: var(--border-color);
        border-radius: var(--border-radius-sm);
        display: inline-block;
    }
    .success {
        height: 100%;
        background-color: var(--color-success);
        display: block;
    }
}

.reward_row {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    label {
        display: flex;
        align-items: start;
    }
}

label {
    font-weight: bolder;
}

.reward {
    display: flex;
    align-items: start;
    color: var(--accent-dark);
}

.offer_detail {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 1rem;
    height: 100%;
    .offer_detail_left {
        border-right: 2px solid var(--border-color);
    }
    .offer_detail_right,
    .offer_detail_left {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: start;
    }
}

@include mixins.mobile-device {
    .offer_detail {
        grid-template-columns: 1fr;
        grid-gap: 0.5rem;
        .offer_detail_left {
            border-right: none;
        }
    }
}

@include mixins.night-mode {
    .reward {
        color: var(--accent);
    }
}
</style>
