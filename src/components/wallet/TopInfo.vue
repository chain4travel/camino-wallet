<template>
    <div class="top_cards">
        <balance-card class="top_card balance_card"></balance-card>
        <address-card class="top_card addr_card"></address-card>
    </div>
</template>
<script>
import BalanceCard from './TopCards/BalanceCard/BalanceCard'
import AddressCard from './TopCards/AddressCard/AddressCard'

export default {
    components: {
        BalanceCard,
        AddressCard,
    },
}
</script>
<style scoped lang="scss">
@use '../../styles/abstracts/variables';
@use '../../styles/abstracts/mixins';

.top_cards {
    @include mixins.component-wrapper;
    background-color: var(--bg-card);
    display: grid;
    grid-template-columns: 1fr 360px;
    // grid-gap: 15px;
    overflow: hidden;
}

.top_card {
    flex-grow: 1;
    color: var(--primary-color);
    flex-shrink: 0;

    // border-radius: var(--border-radius-lg);
    border: 1px solid var(--border-radius-color);
    padding: 12px 20px;
    overflow: hidden;
    animation-name: fade;
    animation-duration: 0.6s;
    animation-timing-function: ease-out;
}

.top_card:not(:last-child) {
    border-right: 1px solid var(--bg-light);
}

.balance_card {
}

.addr_card {
}
.card_left {
    background-color: #f4efff;
    flex-basis: 70px;
    flex-shrink: 0;
    padding: 15px;
    border-bottom-right-radius: 5px;

    img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center;
        fill: #ddd;
    }
}

.card_right {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    padding: 20px 18px;
    padding-bottom: 8px;
}

.top_card h4 {
    color: variables.$primary-color;
    font-weight: bold;
    text-align: left;
}
.top_card p {
    word-break: break-all;
    text-align: left;
    flex-grow: 1;
    margin: 0;
    @include mixins.typography-caption;
}

.balance {
    @include mixins.typography-subtitle-1;
}

.top_card .buts {
    width: 100%;
    text-align: right;
}
.top_card .buts button {
    @include mixins.typography-body-1;
    margin: 0px 18px;
    margin-right: 0px;
    position: relative;
    outline: none;
}

.buts img {
    height: 20px;
    width: 20px;
    object-fit: contain;
}

@include mixins.medium-device {
    .top_cards {
        grid-template-columns: 1fr 320px;
        // grid-gap: 9px;
    }
}

@include mixins.mobile-device {
    .top_cards {
        grid-template-columns: none;
        grid-template-rows: min-content;
        // grid-gap: 9px;
    }

    .top_card {
        /*padding: ;*/
    }

    .balance_card {
        grid-column: unset;
    }

    .addr_card {
        grid-column: unset;
    }
}

//@media only screen and (max-width: variables.$width_m) {
//
//}
</style>
<style lang="scss">
.buts {
    .copyBut {
        width: 20px !important;
    }
}
</style>
