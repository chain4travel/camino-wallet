<template>
    <div class="balance_card">
        <UtxosBreakdownModal ref="utxos_modal"></UtxosBreakdownModal>
        <div class="fungible_card">
            <div class="header">
                <div class="refresh">
                    <Spinner
                        v-if="isUpdateBalance"
                        class="spinner"
                        data-cy="spinner-balance"
                    ></Spinner>
                    <button v-else @click="updateBalance" data-cy="btn-refresh-balance">
                        <v-icon>mdi-refresh</v-icon>
                    </button>
                </div>
                <h4>{{ $t('top.title2') }} ({{ wallet ? wallet.name : 'Unknown' }})</h4>
                <template v-if="!isBreakdown">
                    <button
                        class="breakdown_toggle"
                        @click="toggleBreakdown"
                        data-cy="btn-show-breakdown"
                    >
                        <v-icon>mdi-eye-outline</v-icon>
                        {{ $t('top.balance.show') }}
                    </button>
                </template>
                <template v-else>
                    <button
                        class="breakdown_toggle"
                        @click="toggleBreakdown"
                        data-cy="btn-show-breakdown"
                    >
                        <v-icon>mdi-eye-off-outline</v-icon>
                        {{ $t('top.balance.hide') }}
                    </button>
                </template>
                <button @click="showUTXOsModal" class="breakdown_toggle">Show UTXOs</button>
            </div>
            <div class="balance_row">
                <p class="balance" data-cy="wallet_balance" v-if="!balanceTextRight">
                    {{ balanceTextLeft }} {{ nativeAssetSymbol }}
                </p>
                <p class="balance" data-cy="wallet_balance" v-else>
                    <span>{{ balanceTextLeft }}</span>
                    <small class="smaller">.{{ balanceTextRight }}</small>
                    {{ nativeAssetSymbol }}
                </p>
            </div>
            <div class="alt_info">
                <div class="alt_non_breakdown" v-if="!isBreakdown">
                    <div>
                        <label>{{ $t('top.balance.available') }}</label>
                        <p>{{ unlockedText }} {{ nativeAssetSymbol }}</p>
                    </div>
                    <div>
                        <label>{{ $t('top.locked') }}</label>
                        <p>{{ balanceTextLocked }} {{ nativeAssetSymbol }}</p>
                    </div>
                    <div v-if="!depositAndBond">
                        <label>{{ $t('top.balance.stake') }}</label>
                        <p>{{ stakingText }} {{ nativeAssetSymbol }}</p>
                    </div>
                </div>
                <div class="alt_breakdown" v-else>
                    <div>
                        <div v-if="walletType !== 'multisig'">
                            <label>{{ $t('top.balance.available') }} (X)</label>
                            <p data-cy="top-balance-available-X">
                                {{ avmUnlocked | cleanAvaxBN }} {{ nativeAssetSymbol }}
                            </p>
                        </div>
                        <div>
                            <label>{{ $t('top.balance.available') }} (P)</label>
                            <p data-cy="top-balance-available-P">
                                {{ platformUnlocked | cleanAvaxBN }} {{ nativeAssetSymbol }}
                            </p>
                        </div>

                        <div v-if="walletType !== 'multisig'">
                            <label>{{ $t('top.balance.available') }} (C)</label>
                            <p data-cy="top-balance-available-C">
                                {{ evmUnlocked | cleanAvaxBN }} {{ nativeAssetSymbol }}
                            </p>
                        </div>
                    </div>
                    <div v-if="depositAndBond">
                        <label>{{ $t('top.balance.deposited') }} (P)</label>
                        <p>{{ platformDeposited | cleanAvaxBN }} {{ nativeAssetSymbol }}</p>
                        <label>{{ $t('top.balance.bonded') }} (P)</label>
                        <p>{{ platformBonded | cleanAvaxBN }} {{ nativeAssetSymbol }}</p>
                        <label>{{ $t('top.balance.bonded_deposited') }} (P)</label>
                        <p>{{ platformBondedDeposited | cleanAvaxBN }} {{ nativeAssetSymbol }}</p>
                    </div>
                    <div v-else>
                        <label>{{ $t('top.balance.locked') }} (X)</label>
                        <p>{{ avmLocked | cleanAvaxBN }} {{ nativeAssetSymbol }}</p>
                        <label>{{ $t('top.balance.locked') }} (P)</label>
                        <p>{{ platformLocked | cleanAvaxBN }} {{ nativeAssetSymbol }}</p>
                        <label>{{ $t('top.balance.locked_stake') }} (P)</label>
                        <p>{{ platformLockedStakeable | cleanAvaxBN }} {{ nativeAssetSymbol }}</p>
                    </div>
                    <div v-if="!depositAndBond">
                        <label>{{ $t('top.balance.stake') }}</label>
                        <p>{{ stakingText }} {{ nativeAssetSymbol }}</p>
                    </div>
                </div>
            </div>
        </div>
        <NftCol class="nft_card"></NftCol>
    </div>
</template>
<script lang="ts">
import 'reflect-metadata'
import { Vue, Component, Watch } from 'vue-property-decorator'
import AvaAsset from '@/js/AvaAsset'
import Spinner from '@/components/misc/Spinner.vue'
import NftCol from './NftCol.vue'
import Tooltip from '@/components/misc/Tooltip.vue'

import Big from 'big.js'
import { BN } from '@c4tplatform/caminojs/dist'
import { ONEAVAX } from '@c4tplatform/caminojs/dist/utils'
import { bnToBig } from '@/helpers/helper'
import { priceDict } from '@/store/types'
import { WalletNameType, WalletType } from '@/js/wallets/types'
import UtxosBreakdownModal from '@/components/modals/UtxosBreakdown/UtxosBreakdownModal.vue'
import { ava } from '@/AVA'

@Component({
    components: {
        UtxosBreakdownModal,
        Spinner,
        NftCol,
        Tooltip,
    },
    filters: {
        cleanAvaxBN(val: BN) {
            let big = Big(val.toString()).div(Big(ONEAVAX.toString()))
            return big.toLocaleString()
        },
    },
})
export default class BalanceCard extends Vue {
    isBreakdown = false
    intervalId: NodeJS.Timeout | number | null = null
    $refs!: {
        utxos_modal: UtxosBreakdownModal
    }

    updateBalance(): void {
        this.$store.dispatch('updateBalances')
    }

    showUTXOsModal() {
        this.$refs.utxos_modal.open()
    }

    toggleBreakdown() {
        this.isBreakdown = !this.isBreakdown
    }

    get walletType(): WalletNameType {
        return this.$store.state.activeWallet.type
    }

    get ava_asset(): AvaAsset | null {
        let ava = this.$store.getters['Assets/AssetAVA']
        return ava
    }

    get depositAndBond(): boolean {
        return this.$store.getters['Network/depositAndBond']
    }

    get avmUnlocked(): BN {
        if (!this.ava_asset) return new BN(0)
        return this.ava_asset.amount
    }

    get avmLocked(): BN {
        if (!this.ava_asset) return new BN(0)
        return this.ava_asset.amountLocked
    }

    get evmUnlocked(): BN {
        if (!this.wallet) return new BN(0)
        // convert from ^18 to ^9
        let bal = this.wallet.ethBalance
        return bal.div(new BN(Math.pow(10, 9).toString()))
    }

    get totalBalance(): BN {
        if (!this.ava_asset) return new BN(0)

        let tot = this.ava_asset.getTotalAmount()
        // add EVM balance
        tot = tot.add(this.evmUnlocked)
        return tot
    }

    get totalBalanceBig(): Big {
        if (this.ava_asset) {
            let denom = this.ava_asset.denomination
            let bigTot = bnToBig(this.totalBalance, denom)
            return bigTot
        }
        return Big(0)
    }

    get avaxPriceText() {
        return this.priceDict.usd
    }

    get totalBalanceUSD(): Big {
        let usdPrice = this.priceDict.usd
        let usdBig = this.totalBalanceBig.times(Big(usdPrice))
        return usdBig
    }

    get totalBalanceUSDText(): string {
        if (this.isUpdateBalance) return '--'
        return this.totalBalanceUSD.toLocaleString(2)
    }

    get nativeAssetSymbol(): string {
        return this.ava_asset?.symbol ?? ''
    }

    // should be unlocked (X+P), locked (X+P) and staked and lockedStakeable
    get balanceText(): string {
        if (this.ava_asset !== null) {
            let denom = this.ava_asset.denomination
            return this.totalBalanceBig.toLocaleString(denom)
        } else {
            return '?'
        }
    }

    get balanceTextLeft(): string {
        if (this.isUpdateBalance) return '--'
        let text = this.balanceText
        if (text.includes('.')) {
            let left = text.split('.')[0]
            return left
        }
        return text
    }

    get balanceTextRight(): string {
        if (this.isUpdateBalance) return ''
        let text = this.balanceText
        if (text.includes('.')) {
            let right = text.split('.')[1]
            return right
        }
        return ''
    }

    // Locked balance is the sum of locked CAM tokens P chain (bonded + deposited + bondedAndDeposited)
    // Locked balance is the sum of locked AVAX tokens on X and P chain
    @Watch('$store.state.Network.selectedNetwork.id')
    get balanceTextLocked(): string {
        if (this.isUpdateBalance) return '--'

        if (this.ava_asset !== null) {
            if (this.depositAndBond) {
                let denomination = this.ava_asset.denomination
                let total = this.platformDeposited
                    .add(this.platformBonded)
                    .add(this.platformBondedDeposited)
                let totalDenominated = Big(total.toString()).div(Math.pow(10, denomination))

                return totalDenominated.toLocaleString(denomination)
            } else {
                let denom = this.ava_asset.denomination
                let tot = this.platformLocked.add(this.platformLockedStakeable)
                // let otherLockedAmt = this.platformLocked.add(this.platformLockedStakeable)
                let pLocked = Big(tot.toString()).div(Math.pow(10, denom))
                let amt = this.ava_asset.getAmount(true)
                amt = amt.add(pLocked)

                return amt.toLocaleString(denom)
            }
        } else {
            return '--'
        }
    }

    get platformUnlocked(): BN {
        return this.$store.getters['Assets/walletPlatformBalanceUnlocked']
    }

    get platformLocked(): BN {
        return this.$store.getters['Assets/walletPlatformBalanceLocked']
    }

    get platformLockedStakeable(): BN {
        return this.$store.getters['Assets/walletPlatformBalanceLockedStakeable']
    }

    get platformDeposited(): BN {
        return this.$store.getters['Assets/walletPlatformBalanceDeposited']
    }

    get platformBonded(): BN {
        return this.$store.getters['Assets/walletPlatformBalanceBonded']
    }

    get platformBondedDeposited(): BN {
        return this.$store.getters['Assets/walletPlatformBalanceBondedDeposited']
    }

    get unlockedText() {
        if (this.isUpdateBalance) return '--'

        if (this.ava_asset) {
            let xUnlocked = this.ava_asset.amount
            let pUnlocked = this.platformUnlocked

            let denom = this.ava_asset.denomination

            let tot = xUnlocked.add(pUnlocked).add(this.evmUnlocked)

            let amtBig = bnToBig(tot, denom)

            return amtBig.toLocaleString(denom)
        } else {
            return '--'
        }
    }

    get pBalanceText() {
        if (!this.ava_asset) return '--'
        if (this.isUpdateBalance) return '--'

        let denom = this.ava_asset.denomination
        let bal = this.platformUnlocked
        let bigBal = Big(bal.toString())
        bigBal = bigBal.div(Math.pow(10, denom))

        if (bigBal.lt(Big('1'))) {
            return bigBal.toLocaleString(9)
        } else {
            return bigBal.toLocaleString(3)
        }
    }

    get stakingAmount(): BN {
        return this.$store.getters['Assets/walletStakingBalance']
    }

    get stakingText() {
        let balance = this.stakingAmount
        if (!balance) return '0'
        if (this.isUpdateBalance) return '--'

        let denom = 9
        let bigBal = Big(balance.toString())
        bigBal = bigBal.div(Math.pow(10, denom))

        if (bigBal.lt(Big('1'))) {
            return bigBal.toString()
        } else {
            return bigBal.toLocaleString()
        }
    }

    get wallet(): WalletType | null {
        return this.$store.state.activeWallet
    }

    get isUpdateBalance(): boolean {
        if (!this.wallet) return true
        return this.wallet.isFetchUtxos
    }

    get priceDict(): priceDict {
        return this.$store.state.prices
    }
}
</script>

<style scoped lang="scss">
@use '../../../../styles/abstracts/mixins';
.balance_card {
    display: grid;
    column-gap: 20px;
}

.fungible_card {
    height: 100%;
}

.where_info {
    grid-row: 2;
    grid-column: 1/3;
    margin-top: 8px;
    /*max-width: 460px;*/
}
.header {
    display: flex;

    h4 {
        margin-left: 12px;
        flex-grow: 1;
    }
}
h4 {
    font-weight: normal;
}

.alert_cont {
    margin: 0;
}

.balance_row {
    align-self: center;
}
.balance {
    font-size: 2.4em;
    white-space: normal;
    /*font-weight: bold;*/
    font-family: var(--primary-font);
    span {
        float: left;
    }

    small.smaller {
        font-size: 0.8em;
        /*color: var(--primary-color-light);*/
    }
}

.balance_usd {
    width: max-content;
    background: var(--bg-light);
    color: var(--primary-color-light);
    @include mixins.typography-caption;
    padding: 1px 6px;
    border-radius: 3px;
    margin-right: 6px !important;
}

.refresh {
    width: 20px;
    height: 20px;
    .v-icon {
        color: var(--primary-color);
    }

    button {
        outline: none !important;
    }
    img {
        object-fit: contain;
        width: 100%;
    }

    .spinner {
        color: var(--primary-color) !important;
    }
}
.buts {
    width: 100%;
    text-align: right;
}
.buts button {
    @include mixins.typography-body-1;
    margin: 0px 18px;
    margin-right: 0px;
    position: relative;
    outline: none !important;
}

.buts img {
    height: 20px;
    width: 20px;
    object-fit: contain;
    outline: none !important;
}
.buts button[tooltip]:hover:before {
    border-radius: var(--border-radius-sm);
    /*left: 0;*/
    left: 0;
    transform: translateX(-50%);
    content: attr(tooltip);
    position: absolute;
    background-color: var(--tooltip-bg);
    bottom: 100%;
    color: #fff;
    width: max-content;
    max-width: 100px;
    @include mixins.typography-caption;
    padding: 4px 8px;
    margin-bottom: 4px;
}

.alt_info > div {
    display: grid;
    grid-template-columns: repeat(3, max-content);
    column-gap: 0px;
    margin-top: 12px;
    > div {
        position: relative;
        padding: 0 24px;
        border-right: 2px solid var(--bg-light);
        &:first-of-type {
            padding-left: 0;
        }
        &:last-of-type {
            border: none;
        }
    }

    label {
        @include mixins.typography-caption;
        color: var(--primary-color-light);
    }
}

.breakdown_toggle {
    @include mixins.typography-caption;
    outline: none !important;
    margin-left: 12px;
    .v-icon {
        color: var(--primary-color);
        @include mixins.typography-body-1;
    }

    &:hover {
        .v-icon {
            color: var(--secondary-color);
        }
        color: var(--secondary-color);
    }
}
</style>
