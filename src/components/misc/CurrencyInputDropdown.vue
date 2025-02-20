<template>
    <div>
        <div class="curr_in_drop">
            <div class="max_in_cont hover_border">
                <button class="max_but" @click="maxOut" :disabled="disabled">MAX</button>
                <div class="col_big_in">
                    <big-num-input
                        ref="bigIn"
                        @change="amount_in"
                        :class="['bigIn', { pending: pendingSendMultisigTX && chainId === 'P' }]"
                        contenteditable="bigIn"
                        :max="max_amount"
                        :denomination="denomination"
                        :step="stepSize"
                        :placeholder="pendingSendMultisigTX ? pendingTxAmountString : placeholder"
                        :disabled="disabled || (pendingSendMultisigTX && chainId === 'P')"
                    ></big-num-input>
                </div>
            </div>
            <BalanceDropdown
                :disabled_assets="disabled_assets"
                v-model="asset_now"
                :disabled="disabled"
                :chain-id="chainId"
            ></BalanceDropdown>
            <div class="col_balance">
                <p>
                    {{ $t('misc.balance') }}:
                    {{ maxAmountBig.toLocaleString(denomination) }}
                </p>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { BN } from '@c4tplatform/caminojs/dist'
import 'reflect-metadata'
import { Component, Emit, Prop, Vue, Watch } from 'vue-property-decorator'

// @ts-ignore
import { ICurrencyInputDropdownValue } from '@/components/wallet/transfer/types'
import AvaAsset from '@/js/AvaAsset'
import { IWalletAssetsDict, priceDict } from '@/store/types'
import { BigNumInput } from '@c4tplatform/vue_components'

import { ava } from '@/AVA'
import BalanceDropdown from '@/components/misc/BalancePopup/BalanceDropdown.vue'
import { ChainIdType } from '@/constants'
import { bnToBig } from '@/helpers/helper'
import { WalletHelper } from '@/helpers/wallet_helper'
import { WalletType } from '@/js/wallets/types'
import { MultisigTx as SignavaultTx } from '@/store/modules/signavault/types'
import Big from 'big.js'

@Component({
    components: {
        BigNumInput,
        BalanceDropdown,
    },
})
export default class CurrencyInputDropdown extends Vue {
    amount: BN = new BN(0)
    asset_now: AvaAsset = this.walletAssetsArray[0]

    @Prop({ default: () => [] }) disabled_assets!: AvaAsset[]
    @Prop({ default: '' }) initial!: string
    @Prop({ default: false }) disabled!: boolean
    @Prop() pendingTxAmount?: string
    @Prop() chainId!: ChainIdType
    $refs!: {
        bigIn: BigNumInput
    }

    get pendingTxAmountString() {
        if (this.pendingTxAmount) return this.pendingTxAmount.replace(/\s/g, '')
        return ''
    }
    mounted() {
        if (this.isEmpty) return
        if (this.initial) {
            let initialAsset = this.walletAssetsDict[this.initial]
            this.drop_change(initialAsset)
        } else {
            this.drop_change(this.walletAssetsArray[0])
        }
    }

    get pendingSendMultisigTX(): SignavaultTx | undefined {
        return this.$store.getters['Signavault/transactions'].find(
            (item: any) =>
                item?.tx?.alias === this.wallet.getStaticAddress('P') &&
                WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx) === 'BaseTx'
        )
    }

    get wallet(): WalletType {
        return this.$store.state.activeWallet
    }

    @Watch('asset_now')
    drop_change(val: AvaAsset) {
        this.asset_now = val
        this.$refs.bigIn.clear()
        // this.amount_in(new BN(0))
        this.onchange()
    }

    get stepSize() {
        if (this.denomination > 3) {
            let stepNum = Math.pow(10, this.denomination - 2)
            return new BN(stepNum.toString())
        } else {
            let stepNum = Math.pow(10, this.denomination)
            return new BN(stepNum.toString())
        }
    }
    maxOut() {
        if (this.pendingTxAmount) return
        // @ts-ignore
        this.$refs.bigIn?.maxout()
    }

    amount_in(val: BN) {
        this.amount = val
        this.onchange()
    }

    // onchange event for the Component
    @Emit('change')
    onchange(): ICurrencyInputDropdownValue {
        return {
            asset: this.asset_now,
            amount: this.amount,
        }
    }

    onfocus() {
        console.log('focus')
    }

    get isEmpty(): boolean {
        if (this.walletAssetsArray.length === 0) {
            return true
        } else {
            return false
        }
    }

    get isAvax(): boolean {
        if (this.asset_now.id === this.avaxAsset?.id) return true
        return false
    }

    get display(): string {
        return ''
    }

    get placeholder(): string {
        if (this.isEmpty || !this.asset_now) return '0.00'
        let deno = this.asset_now.denomination
        let res = '0'
        if (deno > 2) {
            res = '0.00'
        }
        return res
    }

    get denomination(): number {
        if (!this.asset_now) return 0
        return this.asset_now.denomination
    }

    get walletAssetsArray(): AvaAsset[] {
        return this.$store.getters['Assets/walletAssetsArray']
    }

    get walletAssetsDict(): IWalletAssetsDict {
        return this.$store.getters['Assets/walletAssetsDict']
    }

    get avaxAsset(): AvaAsset | null {
        return this.$store.getters['Assets/AssetAVA']
    }

    get platformUnlocked(): BN {
        return this.$store.getters['Assets/walletPlatformBalanceUnlocked']
    }
    get max_amount(): null | BN {
        if (!this.asset_now) return null
        if (!this.avaxAsset) return null

        let assetId = this.asset_now.id
        let balance = this.walletAssetsDict[assetId]
        const amount = this.chainId === 'P' ? this.platformUnlocked : balance.amount

        let avaxId = this.avaxAsset.id

        // Max amount is BALANCE - FEE for native Asset
        if (assetId === avaxId) {
            let fee = ava.XChain().getTxFee()
            // console.log(fee);
            if (fee.gte(amount)) {
                return new BN(0)
            } else {
                return amount.sub(fee)
            }
        }

        if (amount.isZero()) return null
        return amount
    }

    get maxAmountBig(): Big {
        if (!this.max_amount) return Big(0)
        return bnToBig(this.max_amount, this.denomination)
    }

    get priceDict(): priceDict {
        return this.$store.state.prices
    }
}
</script>
<style scoped lang="scss">
@use '../../styles/abstracts/mixins';

.bigIn {
    width: 100%;
    border: none !important;
    @include mixins.typography-body-2;
}
.pending {
    color: var(--primary-color-light) !important;
}

.max_in_cont {
    position: relative;
    display: grid;
    grid-template-columns: max-content 1fr;
    padding: 8px 14px;
    border-radius: var(--border-radius-sm);
}

.curr_in_drop {
    display: grid;
    grid-template-columns: 1fr 90px;
    background-color: transparent;
    width: 100%;
    outline: none;
    text-align: right;
    column-gap: 10px;

    > * {
        background-color: var(--bg-light);
        border-radius: var(--border-radius-sm);
    }
}

input {
    flex-grow: 1;
    outline: none;
    text-align: right;
    flex-basis: 0px;
    width: 0px;
    color: var(--primary-color);
}

.max_but {
    opacity: 0.4;
    @include mixins.typography-caption;
    &:hover {
        opacity: 1;
    }
}

.dropdown {
    /*flex-basis: 140px;*/
    width: 100%;
    /*border-left: 1px solid #d2d2d2;*/
}

.balance {
    display: grid;
    column-gap: 10px;
    grid-template-columns: 1fr 140px;
    @include mixins.typography-body-2;
    color: var(--primary-color-light);
    padding: 2px 0px;

    > div {
        display: flex;
        justify-content: space-between;
    }

    p {
        padding: 2px 0px;
    }

    p:last-child {
        text-align: right;
    }

    span {
        font-family: var(--primary-font);
        padding-left: 14px;
    }
}

.col_big_in {
    text-align: right;
    font-family: var(--primary-font);
    display: flex;
    flex-direction: column;
}

.col_balance {
    padding-right: 14px;
    padding-top: 2px !important;
    @include mixins.typography-body-2;
    color: var(--primary-color-light);
    font-family: var(--primary-font);
    background-color: transparent;
}

@include mixins.medium-device {
    .balance {
        grid-template-columns: 1fr;
    }
}

@include mixins.mobile-device {
    .balance,
    .curr_in_drop {
        grid-template-columns: 1fr 90px;
    }

    .balance {
        @include mixins.typography-caption;
    }
}
</style>
