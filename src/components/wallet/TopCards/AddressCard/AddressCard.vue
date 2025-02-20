<template>
    <div class="addr_card">
        <q-r-modal ref="qr_modal" :address="activeAddress"></q-r-modal>
        <paper-wallet
            ref="print_modal"
            v-if="walletType === 'mnemonic'"
            :wallet="activeWallet"
        ></paper-wallet>
        <p class="addr_info">{{ addressMsg }}</p>
        <div class="bottom">
            <div class="col_qr">
                <canvas ref="qr"></canvas>
            </div>
            <div class="bottom_rest">
                <p class="subtitle">{{ addressLabel }}</p>

                <p class="addr_text" data-cy="wallet_address">
                    {{ activeAddress }}
                </p>
                <div class="buts">
                    <button :tooltip="$t('top.hover1')" @click="viewQRModal" class="qr_but">
                        <v-icon>mdi-qrcode</v-icon>
                    </button>
                    <button
                        v-if="walletType === 'mnemonic'"
                        :tooltip="$t('top.hover2')"
                        @click="viewPrintModal"
                        class="print_but"
                    >
                        <v-icon>mdi-water-outline</v-icon>
                    </button>
                    <button
                        v-if="walletType === 'ledger'"
                        :tooltip="$t('create.verify')"
                        @click="verifyLedgerAddress"
                        class="ledger_but"
                    >
                        <v-icon>mdi-usb-flash-drive-outline</v-icon>
                    </button>
                    <CopyText
                        :tooltip="$t('top.hover3')"
                        :value="activeAddress"
                        class="copy_but"
                    ></CopyText>
                </div>
            </div>
        </div>
        <div class="bottom_tabs">
            <ChainSelect v-model="chainNow"></ChainSelect>
        </div>
    </div>
</template>
<script lang="ts">
import 'reflect-metadata'

import QRCode from 'qrcode'
import { Component, Vue, Watch } from 'vue-property-decorator'

import { ava } from '@/AVA'
import CopyText from '@/components/misc/CopyText.vue'
import PaperWallet from '@/components/modals/PaperWallet/PaperWallet.vue'
import QRModal from '@/components/modals/QRModal.vue'
import ChainSelect from '@/components/wallet/TopCards/AddressCard/ChainSelect.vue'
import { ChainIdType } from '@/constants'
import { LedgerWallet } from '@/js/wallets/LedgerWallet'
import MnemonicWallet, {
    AVA_ACCOUNT_PATH,
    LEDGER_ETH_ACCOUNT_PATH,
} from '@/js/wallets/MnemonicWallet'
import { WalletNameType, WalletType } from '@/js/wallets/types'
import { toChecksumAddress } from 'web3-utils'
@Component({
    components: {
        CopyText,
        PaperWallet,
        QRModal,
        ChainSelect,
    },
})
export default class AddressCard extends Vue {
    colorLight: string = '#FFF'
    colorDark: string = '#242729'
    chainNow: ChainIdType = this.walletType === 'multisig' ? 'P' : 'X'

    $refs!: {
        qr_modal: QRModal
        print_modal: PaperWallet
        qr: HTMLCanvasElement
    }

    @Watch('activeAddress')
    onaddrchange() {
        this.updateQR()
    }

    @Watch('themeSelected', { immediate: true })
    onthemechange(val: string) {
        if (val === 'dark') {
            this.colorDark = '#E5E5E5'
            this.colorLight = '#0f172a'
        } else {
            this.colorDark = '#242729'
            this.colorLight = '#FFF'
        }
        this.updateQR()
    }

    @Watch('activeWallet', { immediate: true })
    onActiveWalletChange(wlt: WalletType | null) {
        if (wlt?.type === 'multisig') {
            this.chainNow = 'P'
        } else {
            this.chainNow = 'X'
        }
    }

    get addressLabel(): string {
        switch (this.chainNow) {
            default:
                return this.$t('top.address.title_x') as string
            case 'P':
                return this.$t('top.address.title_p') as string
            case 'C':
                return this.$t('top.address.title_c') as string
        }
    }
    get themeSelected(): string {
        return this.$store.state.theme
    }
    get addressMsg(): string {
        switch (this.chainNow) {
            default:
                return this.getAddressMsgX()
            case 'P':
                return this.$t(
                    this.walletType === 'multisig'
                        ? 'top.address.desc_p_multisig'
                        : 'top.address.desc_p'
                ) as string
            case 'C':
                return this.$t('top.address.desc_c') as string
        }
    }

    getAddressMsgX() {
        if (this.activeWallet?.type === 'singleton') {
            return this.$t('top.address.desc_x_1') as string
        } else {
            return `${this.$t('top.address.desc_x_1')} ${this.$t('top.address.desc_x_2')}` as string
        }
    }

    get isDayTheme(): boolean {
        //@ts-ignore
        return this.$root.theme === 'light'
    }

    get walletType(): WalletNameType {
        let wallet = this.activeWallet
        if (!wallet) return 'mnemonic'
        return wallet.type
    }

    get activeWallet(): WalletType | null {
        return this.$store.state.activeWallet
    }
    get address() {
        let wallet = this.activeWallet
        if (!wallet) {
            return '-'
        }
        return wallet.getCurrentAddressAvm()
    }

    get addressPVM() {
        let wallet = this.activeWallet
        if (!wallet) {
            return '-'
        }

        return wallet.getCurrentAddressPlatform()
    }

    get addressEVM() {
        let wallet = this.activeWallet
        if (!wallet) {
            return '-'
        }
        return toChecksumAddress('0x' + wallet.getEvmAddress())
    }

    get activeAddress(): string {
        switch (this.chainNow) {
            case 'X':
                return this.address
            case 'P':
                return this.addressPVM
            case 'C':
                return this.addressEVM
            default:
                return this.address
        }
    }

    get activeIdx(): number {
        const wallet = this.activeWallet as MnemonicWallet
        const walletType = wallet.type

        if (walletType === 'singleton') return 0

        switch (this.chainNow) {
            case 'X':
                return wallet.getExternalActiveIndex()
            case 'P':
                return wallet.getPlatformActiveIndex()
            default:
                return 0
        }
    }

    viewQRModal() {
        // @ts-ignore
        this.$refs.qr_modal.open()
    }
    viewPrintModal() {
        let modal = this.$refs.print_modal
        // @ts-ignore
        modal.open()
    }
    updateQR() {
        let canvas = this.$refs.qr as HTMLCanvasElement
        if (!canvas) return

        let size = canvas.clientWidth
        QRCode.toCanvas(
            canvas,
            this.activeAddress,
            {
                scale: 6,
                color: {
                    light: this.colorLight,
                    dark: this.colorDark,
                },
                width: size,
                // height: size,
            },
            function (error: any) {
                if (error) console.error(error)
            }
        )
    }

    async verifyLedgerAddress() {
        const wallet = this.activeWallet as LedgerWallet

        let hrp = ava.getHRP()

        switch (this.chainNow) {
            case 'X':
            case 'P':
                wallet.app.getWalletAddress(`${AVA_ACCOUNT_PATH}/0/${this.activeIdx}`, hrp)
                break
            case 'C':
                wallet.ethApp.getAddress(`${LEDGER_ETH_ACCOUNT_PATH}`)
        }
    }

    mounted() {
        this.updateQR()
    }
}
</script>
<style scoped lang="scss">
@use '../../../../styles/abstracts/variables';
@use '../../../../styles/abstracts/mixins';

.addr_card {
    display: flex;
    flex-direction: column;
    padding: 0 !important;
}
.buts {
    width: 100%;
    display: flex;
    align-items: center;
    color: var(--secondary-color);
    justify-content: flex-end;

    > * {
        @include mixins.typography-body-2;
        margin-left: 14px;
        position: relative;
        outline: none;
        // width: 18px;
        // height: 18px;
        opacity: 0.6;

        background-size: contain;
        background-position: center;
        &:hover {
            opacity: 1;
        }
    }
    .v-icon {
        color: var(--primary-color);
        width: 18px;
        height: 18px;
        @include mixins.typography-subtitle-1;
    }
}

// .qr_but {
//     background-image: url('/img/qr_icon.png');
//     .v-icon {
//     color: var(--primary-color);
//     }
// }
// .print_but {
//     background-image: url('/img/faucet_icon.png');
// }
// .ledger_but {
//     background-image: url('/img/ledger_icon.png');
// }
.copy_but {
    color: var(--primary-color);
}

.col_qr {
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.mainnet_but {
    /* background-image: url('/img/modal_icons/mainnet_addr.svg'); */
}

@include mixins.night-mode {
    // .qr_but {
    //     background-image: url('/img/qr_icon_night.svg');
    // }
    // .print_but {
    //     background-image: url('/img/print_icon_night.svg');
    // }
    // .ledger_but {
    //     background-image: url('/img/ledger_night.svg');
    // }

    .mainnet_but {
        /* background-image: url("/img/modal_icons/mainnet_addr_night.svg"); */
    }
}

.addr_info {
    margin: 19px !important;
    margin-bottom: 0 !important;
    background-color: var(--bg-light);
    @include mixins.typography-caption;
    font-weight: bold;
    text-align: center;
    padding: 12px 16px;
    border-radius: var(--border-radius-sm);
}

$qr_width: 110px;

.bottom {
    display: grid;
    grid-template-columns: $qr_width 1fr;
    column-gap: 14px;
    padding-right: 18px;
    margin-top: 4px;
    margin-bottom: 4px;
    padding-left: 8px;
    flex-grow: 1;

    canvas {
        width: $qr_width;
        height: $qr_width;
        background-color: transparent;
    }

    .bottom_rest {
        padding-top: 4px;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
}

.sub {
    margin: 0px 10px !important;
    text-align: center;
    font-size: 0.7rem;
    background-color: variables.$secondary-color;
    color: #fff;
    padding: 3px 6px;
    border-radius: 3px;
}

.subtitle {
    font-size: 0.7rem;
    color: var(--primary-color-light);
}

.addr_text {
    @include mixins.typography-body-2;
    word-break: break-all;
    color: var(--primary-color);
    min-height: 55px;
}
</style>
