<template>
    <div class="my_keys">
        <p class="label">{{ $t('keys.active_wallet') }}</p>
        <key-row
            v-if="activeWallet"
            :wallet="activeWallet"
            class="key_row"
            :is_default="true"
            :isSuite="isSuite"
        ></key-row>
        <hr v-if="inactiveWallets.length > 0" />
        <p class="label" v-if="hasOtherKeys">
            {{ $t('keys.other_keys') }}
        </p>
        <div v-if="showMultiSigAliases" class="container">
            <p class="aliases--header">
                {{ $t('keys.multisig_aliases', { '0': multiSigAliases.length }) }}
            </p>
            <Alert variant="negative" v-if="error">{{ error }}</Alert>
            <div class="aliases__content">
                <p>{{ $t('keys.import_wallets') }}</p>
                <div class="aliases__content--buttons">
                    <CamBtn @click="dismiss" variant="transparent">
                        {{ $t('keys.button5') }}
                    </CamBtn>
                    <CamBtn @click="addAlias" :loading="isLoading" variant="primary">
                        {{ $t('keys.button4') }}
                    </CamBtn>
                </div>
            </div>
        </div>
        <transition-group name="fade" class="other-keys">
            <key-row
                :isSuite="isSuite"
                v-for="wallet in inactiveWallets"
                :wallet="wallet"
                :key="wallet.id"
                class="key_row"
                @select="selectWallet"
                @remove="removeWallet(wallet)"
            ></key-row>
        </transition-group>
    </div>
</template>

<script lang="ts">
import 'reflect-metadata'
import { Component, Vue, Watch, Prop } from 'vue-property-decorator'

import { bintools } from '@/AVA'
import RememberKey from '@/components/misc/RememberKey.vue'
import KeyRow from '@/components/wallet/manage/KeyRow.vue'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'
import { WalletType } from '@/js/wallets/types'
import CamBtn from '@/components/CamBtn.vue'
import Alert from '@/components/Alert.vue'

@Component({
    components: {
        KeyRow,
        RememberKey,
        CamBtn,
        Alert,
    },
})
export default class MyKeys extends Vue {
    @Prop() isSuite?: boolean
    error: string = ''
    isLoading: boolean = false
    imported: boolean = false

    get account() {
        return this.$store.getters['Accounts/account']
    }

    get getPendingTransaction() {
        return this.$store.getters['Signavault/importedTransactions']
    }

    get inactiveWallets(): WalletType[] {
        return this.checkInactivePendingWallet()
    }

    get wallets(): WalletType[] {
        return this.$store.state.wallets
    }

    get activeWallet(): WalletType {
        return this.$store.state.activeWallet
    }

    get activeNetworkStatus() {
        return this.$store.state.Network.status
    }

    get multiSigAliases(): string[] {
        return this.$store.getters.multiSigAliases
    }

    get hasOtherKeys(): boolean {
        return this.inactiveWallets.length > 0 || this.multiSigAliases.length > 0
    }

    get showMultiSigAliases(): boolean {
        return this.multiSigAliases.length > 0 && !this.imported
    }

    beforeMount() {
        this.checkIfImported()
    }

    @Watch('activeWallet')
    walletChanged() {
        if (this.globalHelper().updateStore) {
            this.globalHelper().updateStore('updateName')
        }
    }

    @Watch('activeNetworkStatus')
    async handleNetworkChanged() {
        if (this.activeNetworkStatus === 'connected' && this.multiSigAliases.length > 0) {
            this.imported = false
        }
    }

    checkIfImported() {
        for (const alias of this.multiSigAliases) {
            const aliasBuffer = bintools.stringToAddress(`P-${alias}`)
            for (const wallet of this.$store.state.wallets) {
                if (
                    wallet.type === 'multisig' &&
                    (wallet as MultisigWallet).alias().compare(aliasBuffer) === 0
                ) {
                    this.imported = true
                }
            }
        }
    }

    selectWallet(wallet: WalletType) {
        this.$store.dispatch('activateWallet', wallet)
    }

    async removeWallet(wallet: WalletType) {
        if (confirm(this.$t('keys.del_check') as string)) {
            await this.$store.dispatch('removeWallet', wallet)
            this.globalHelper().dispatchNotification({
                message: this.$t('notifications.keys_remove_success'),
                type: 'success',
            })
        }
    }

    dismiss() {
        this.$store.dispatch('fetchMultiSigAliases', { disable: true })
    }

    addAlias() {
        this.isLoading = true
        this.error = ''
        setTimeout(async () => {
            try {
                const multisigAliases = this.multiSigAliases.map((alias) => 'P-' + alias)
                const multisigWallets = await this.$store.dispatch('addWalletsMultisig', {
                    keys: multisigAliases,
                })
                await this.$store.dispatch('Signavault/updateImportedMultiSigTransaction')
                if (!multisigWallets || multisigWallets.length === 0) {
                    this.error = 'No address intersection with signing wallets found!'
                } else {
                    this.globalHelper().updateStore('updatePendingTxState', true)
                    this.globalHelper().dispatchNotification({
                        message: `Added ${multisigWallets.length} multisig ${multisigWallets.length > 1 ? 'wallets' : 'wallet'} from ${multisigAliases.length} multisig ${multisigAliases.length > 1 ? 'aliases' : 'alias'}`,
                        type: 'success',
                    })
                    this.imported = true
                    this.error = ''
                }
            } catch (e: any) {
                this.error = e.message.includes('already')
                    ? (this.$t('keys.import_key_duplicate_err') as string)
                    : (this.$t('keys.import_key_err') as string)
                console.error(e)
            } finally {
                this.isLoading = false
            }
        }, 200)
    }

    checkInactivePendingWallet() {
        const pendingTxs = this.getPendingTransaction
        const wallets = this.wallets.filter((wallet) => wallet !== this.activeWallet)

        const assignPendingTx = (wallet: WalletType) => {
            if (wallet.type === 'multisig') {
                delete wallet.pendingTx
                const matchingTx = pendingTxs.find(
                    (tx) => tx.tx.alias === wallet.getStaticAddress('P')
                )
                if (matchingTx) {
                    Object.assign(wallet, { pendingTx: matchingTx })
                }
            }
        }

        // Check active wallet
        assignPendingTx(this.activeWallet)

        // Check inactive wallets
        wallets.forEach(assignPendingTx)
        return wallets
    }
}
</script>

<style scoped lang="scss">
@use '../../../styles/abstracts/mixins';

.other-keys {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.container {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: var(--spacing-space-lg);
    border-radius: var(--border-radius-xl);
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    font-size: 14px;
    font-weight: 700;
    gap: 4px;
    transition-duration: 0.2s;

    .aliases__content {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-wrap: wrap;

        &--buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            flex-wrap: wrap;
        }
    }
}

.addAliasButton {
    padding: 7px 15px;
    font-size: 14px;
    margin-top: 10px;
}

hr {
    border-top: 1px solid var(--bg-light);
    border-left: 1px solid var(--bg-light);
    border-right: 1px solid var(--bg-light);
    border-color: var(--bg-light) !important;
    margin: 12px 0;
}

.label {
    @include mixins.typography-caption;
    color: #999;
    font-weight: bold;
    padding: 2px 10px;
}

.key_row {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: var(--spacing-space-lg);
    border-radius: var(--border-radius-xl);
}

.my_keys {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.volatile_cont {
    max-width: 380px;
    margin-top: 20px;
    padding-top: 20px;
}

.alert_box {
    font-size: 0.9rem;
}

@media (max-width: 768px) {
    .container,
    .aliases__content,
    .aliases__content--buttons {
        flex-direction: column;
        align-items: center;
    }

    .addAliasButton {
        width: 100%;
        margin-top: 10px;
    }
}
</style>

<style lang="scss">
.volatile_cont {
    .v-expansion-panel {
        background-color: transparent !important;
    }

    .passwords input {
        background-color: #d2e9fd;
    }

    .v-expansion-panel-header,
    .v-expansion-panel-content__wrap {
        padding: 8px 0;
    }
}
</style>
