<template>
    <div class="asset">
        <div class="icon" :avax="isAvaxToken">
            <img v-if="iconUrl" :src="iconUrl" />
            <p v-else>?</p>
        </div>
        <p class="name_col not_mobile">
            {{ name }} ({{ symbol }})
            <span v-if="!isAvaxToken">ANT</span>
        </p>
        <p class="name_col mobile_only">{{ symbol }}</p>
        <router-link :to="sendLink" class="send_col" v-if="isBalance">
            <img v-if="$root.theme === 'light'" src="@/assets/sidebar/transfer_nav.png" />
            <img v-else src="@/assets/sidebar/transfer_nav_night.svg" />
        </router-link>
        <p v-else></p>
        <p class="balance_col" v-if="isBalance">
            <span>
                {{ amtBig.toLocaleString() }}
            </span>
        </p>
        <p class="balance_col" v-else>0</p>
    </div>
</template>
<script lang="ts">
import 'reflect-metadata'

import { BN } from '@c4tplatform/caminojs/dist'
import Big from 'big.js'
import { Component, Prop, Vue } from 'vue-property-decorator'

import Hexagon from '@/components/misc/Hexagon.vue'
import { WalletType } from '@/js/wallets/types'

import { bnToBig } from '../../../helpers/helper'
import AvaAsset from '../../../js/AvaAsset'
import { priceDict } from '../../../store/types'

@Component({
    components: {
        Hexagon,
    },
})
export default class FungibleRow extends Vue {
    @Prop() asset!: AvaAsset

    get iconUrl(): string | null {
        if (!this.asset) return null

        if (this.isAvaxToken) {
            return '/img/native_token.png'
        }

        return null
    }

    get isBalance(): boolean {
        if (!this.asset) return false
        if (!this.amount.isZero()) {
            return true
        }
        return false
    }

    get priceDict(): priceDict {
        return this.$store.state.prices
    }

    get sendLink(): string {
        if (!this.asset) return `/wallet/transfer`
        return `/wallet/transfer?asset=${this.asset.id}&chain=X`
    }

    get avaxToken(): AvaAsset {
        return this.$store.getters['Assets/AssetAVA']
    }

    get isAvaxToken(): boolean {
        if (!this.asset) return false

        if (this.avaxToken.id === this.asset.id) {
            return true
        } else {
            return false
        }
    }

    get name(): string {
        return this.asset.name
    }

    get symbol(): string {
        return this.asset.symbol
    }

    get amount() {
        let amt = this.asset.getTotalAmount()
        return amt.add(this.evmAvaxBalance)
    }

    get amtBig() {
        return bnToBig(this.amount, this.asset.denomination)
    }

    get evmAvaxBalance(): BN {
        let wallet: WalletType | null = this.$store.state.activeWallet

        if (!this.isAvaxToken || !wallet) {
            return new BN(0)
        }
        // Convert to 9 decimal places
        let bal = wallet.ethBalance
        let balRnd = bal.divRound(new BN(Math.pow(10, 9).toString()))
        return balRnd
    }
}
</script>
<style scoped lang="scss">
@use '../../../styles/abstracts/mixins';

.asset {
    padding: 14px 0px;
    justify-self: center;

    > * {
        align-self: center;
    }

    .balance_col {
        @include mixins.typography-body-1;
        text-align: right;
    }

    .name_col {
        padding-left: 15px;
        white-space: nowrap;
        overflow-y: hidden;
        text-overflow: ellipsis;
    }

    .send_col {
        text-align: center;
        opacity: 0.4;
        &:hover {
            opacity: 1;
        }
        img {
            width: 18px;
            object-fit: contain;
        }
    }
}

$icon_w: 40px;
.icon {
    position: relative;
    align-self: center;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    transition-duration: 1s;
    width: $icon_w;
    height: $icon_w;
    border-radius: $icon_w;
    background-color: var(--bg-light);

    p {
        color: var(--primary-color-light);
    }

    img {
        width: 100%;
        object-fit: contain;
    }
}

.hex_bg {
    height: 100%;
    width: 100%;
}

.mobile_only {
    display: none;
}

.name_col {
    span {
        @include mixins.typography-caption;
        color: var(--secondary-color);
    }
}

@include mixins.medium-device {
    .asset {
        padding: 6px 0;
    }

    .balance_col {
        span {
            @include mixins.typography-body-2;
        }
        @include mixins.typography-body-2;
    }
    .send_col {
        img {
            width: 14px;
        }
    }

    .name_col {
        @include mixins.typography-caption;
    }

    $icon_w: 30px;
    .icon {
        width: $icon_w;
        height: $icon_w;
        border-radius: $icon_w;
    }
}
@include mixins.mobile-device {
    .name_col {
        display: none;
    }

    .balance_col {
        font-size: 1rem !important;
    }

    .mobile_only {
        display: initial;
    }
}
</style>
