<template>
    <div class="wallet_view" ref="wallet_view">
        <div class="top-bar">
            <div class="container">
                <div class="links">
                    <router-link to="/wallet" class="wallet_link">
                        {{ $t('wallet.sidebar.portfolio') }}
                    </router-link>
                    <router-link
                        to="/wallet/transfer"
                        data-cy="wallet_transfer"
                        class="wallet_link"
                    >
                        {{ $t('wallet.sidebar.send') }}
                    </router-link>
                    <router-link
                        v-if="walletType !== 'multisig'"
                        to="/wallet/cross_chain"
                        data-cy="wallet_export"
                        class="wallet_export wallet_link"
                    >
                        {{ $t('wallet.sidebar.export') }}
                    </router-link>
                    <router-link
                        to="/wallet/validator"
                        data-cy="wallet_validator"
                        class="wallet_validator wallet_link"
                    >
                        {{ $t('wallet.sidebar.validator') }}
                    </router-link>
                    <router-link to="/wallet/earn" data-cy="wallet_earn" class="wallet_link">
                        {{ $t('wallet.sidebar.earn') }}
                    </router-link>
                    <router-link to="/wallet/studio" data-cy="wallet_studio" class="wallet_link">
                        {{ $t('wallet.sidebar.studio') }}
                    </router-link>
                    <router-link
                        to="/wallet/activity"
                        data-cy="wallet_activity"
                        class="wallet_link"
                    >
                        {{ $t('wallet.sidebar.activity') }}
                    </router-link>
                    <router-link to="/wallet/keys" data-cy="wallet_manage" class="wallet_link">
                        {{ $t('wallet.sidebar.manage') }}
                    </router-link>
                    <router-link
                        to="/wallet/advanced"
                        data-cy="wallet_advanced"
                        class="wallet_link"
                    >
                        {{ $t('wallet.sidebar.advanced') }}
                    </router-link>
                </div>
            </div>
        </div>
        <div class="container content">
            <div class="wallet_main">
                <top-info class="wallet_top"></top-info>
                <transition name="fade" mode="out-in">
                    <keep-alive
                        :exclude="[
                            'cross_chain',
                            'activity',
                            'advanced',
                            'earn',
                            'manage',
                            'studio',
                        ]"
                    >
                        <router-view id="wallet_router" :key="$route.path"></router-view>
                    </keep-alive>
                </transition>
            </div>
            <transition name="fade" mode="out-in">
                <main-panel />
            </transition>
        </div>
    </div>
</template>

<script lang="ts">
import MainPanel from '@/components/SidePanels/MainPanel.vue'
import TopInfo from '@/components/wallet/TopInfo.vue'
import { WalletNameType } from '@/js/wallets/types'
import { Component, Vue } from 'vue-property-decorator'

const TIMEOUT_DURATION = 60 * 7 // in seconds
const TIMEOUT_DUR_MS = TIMEOUT_DURATION * 1000

@Component({
    components: {
        MainPanel,
        TopInfo,
    },
})
export default class Wallet extends Vue {
    intervalId: number | null = null
    logoutTimestamp = Date.now() + TIMEOUT_DUR_MS
    isLogOut = false
    helper = this.globalHelper()

    // define links
    links = [
        {
            id: 1,
            text: this.$t('wallet.sidebar.portfolio'),
            path: '/wallet',
        },
        {
            id: 2,
            text: this.$t('wallet.sidebar.send'),
            path: '/wallet/transfer',
        },
        {
            id: 3,
            text: this.$t('wallet.sidebar.export'),
            path: '/wallet/cross_chain',
        },
        {
            id: 4,
            text: this.$t('wallet.sidebar.validator'),
            path: '/wallet/validator',
        },
        {
            id: 5,
            text: this.$t('wallet.sidebar.earn'),
            path: '/wallet/earn',
        },
        {
            id: 6,
            text: this.$t('wallet.sidebar.studio'),
            path: '/wallet/studio',
        },
        {
            id: 7,
            text: this.$t('wallet.sidebar.activity'),
            path: '/wallet/activity',
        },
        {
            id: 8,
            text: this.$t('wallet.sidebar.manage'),
            path: '/wallet/keys',
        },
        {
            id: 9,
            text: this.$t('wallet.sidebar.advanced'),
            path: '/wallet/advanced',
        },
    ]

    get walletType(): WalletNameType {
        return this.$store.state.activeWallet.type
    }

    // Set the logout timestamp to now + TIMEOUT_DUR_MS
    resetTimer() {
        this.logoutTimestamp = Date.now() + TIMEOUT_DUR_MS
    }

    checkLogout() {
        let now = Date.now()

        // Logout if current time is passed the logout timestamp
        if (now >= this.logoutTimestamp && !this.isLogOut) {
            this.isLogOut = true
            this.helper.updateSuiteStore(this.$store.state)
        }
    }

    unload(event: BeforeUnloadEvent) {
        // user has no wallet saved
        if (!localStorage.getItem('w') && this.hasVolatileWallets && this.isLogOut) {
            event.preventDefault()
            this.isLogOut = false
            event.returnValue = ''
            this.$router.push('/wallet/keys')
            this.resetTimer()
        }
    }

    mounted() {
        let view = this.$refs.wallet_view as HTMLDivElement

        view.addEventListener('mousemove', this.resetTimer)
        view.addEventListener('mousedown', this.resetTimer)

        window.addEventListener('beforeunload', this.unload)
    }

    beforeDestroy() {
        let view = this.$refs.wallet_view as HTMLDivElement
        // Remove Event Listeners
        view.removeEventListener('mousemove', this.resetTimer)
        view.removeEventListener('mousedown', this.resetTimer)
        window.removeEventListener('beforeunload', this.unload)
    }

    destroyed() {
        clearInterval(this.intervalId!)
    }

    get hasVolatileWallets() {
        return this.$store.getters.accountChanged
    }
}
</script>
<style scoped lang="scss">
@use '../styles/main';
.content {
    width: 100%;
    margin-top: 60px;
    display: grid;
    column-gap: 15px;
    background-color: var(--bg);
    grid-template-columns: 1fr 300px;
    align-items: center;
    padding: 12px 0px;
}

.top-bar {
    position: fixed;
    width: 100%;
    height: 60px;
    z-index: 9;
    display: flex;
    align-items: center;
    background-color: var(--bg-card);
    border-bottom: 1px solid var(--border-color);
    left: 0;
    justify-content: center;
    padding-left: 24px;
    padding-right: 24px;
    min-width: 100vw;
    .links {
        display: flex;
        flex-direction: row;
        gap: 14px;
        a {
            opacity: 0.6;
            color: var(--sidebar-links);
            text-decoration: none;
            border-radius: var(--border-radius-lg);
            font-weight: 700;
        }

        .wallet_link {
            display: flex;
            align-items: center;
            padding: 6px 8px;
            white-space: nowrap;
            &:first-child {
                padding-left: 0px !important;
            }
        }
        a.router-link-exact-active {
            color: var(--primary-color) !important;
            opacity: 1;
        }
    }
    .container {
        padding: 0px;
        overflow: auto;
    }
}

@media screen and (max-width: 900px) {
    .top-bar {
        top: 65px;
    }
}
@media screen and (max-width: 900px) {
    .content {
        grid-template-columns: 1fr;
    }
}
@media screen and (max-width: 600px) {
    .content {
        padding: 12px 0px;
    }
}
</style>
