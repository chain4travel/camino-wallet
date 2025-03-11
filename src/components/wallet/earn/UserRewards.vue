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
