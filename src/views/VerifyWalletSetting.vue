<template>
    <div v-if="shouldShowVerification" class="verify-wallet--container">
        <div class="header">
            <h1>{{ $t('verify_wallet.title') }}</h1>
            <p v-html="description"></p>
        </div>

        <div class="content">
            <div v-for="(item, index) in verificationItems" :key="index" class="content-item">
                <div class="content-item-action">
                    <h2>{{ $t(`verify_wallet.verificationItems.${item.type}.title`) }}</h2>
                    <v-icon
                        v-if="isVerified(item.type) && !isMultisig"
                        :class="isVerified(item.type) ? 'v-icon--check-decagram' : ''"
                    >
                        mdi-check-decagram
                    </v-icon>
                    <template v-else>
                        <component
                            :is="item.modalComponent"
                            :ref="getModalRefKey(item.type, index)"
                        ></component>
                        <CamBtn
                            variant="primary"
                            :disabled="wallet?.type === 'multisig'"
                            @click="openModal(item.type, index)"
                        >
                            Start
                        </CamBtn>
                    </template>
                </div>
                <h3>{{ $t(`verify_wallet.verificationItems.${item.type}.description`) }}</h3>

                <ul class="content-item-list">
                    <li v-for="(benefit, idx) in item.benefits" :key="idx">
                        <v-icon>mdi-check-circle</v-icon>
                        {{ benefit }}
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import CamBtn from '@/components/CamBtn.vue'
import KycModal from '@/components/modals/KycModal.vue'
import KybModal from '@/components/modals/KybModal.vue'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'
import { WalletType } from '@/js/wallets/types'

interface VerificationItem {
    type: 'kyc' | 'kyb'
    benefits: string[]
    modalComponent: typeof Vue
}

interface ModalComponent extends Vue {
    open(): void
}

@Component({
    components: { CamBtn, KycModal, KybModal },
})
export default class VerifyWalletSetting extends Vue {
    description = this.$t('verify_wallet.description', {
        kycLink: '<a href="https://docs.camino.network/guides/kyc" target="_blank">KYC</a>',
        kybLink: '<a href="https://docs.camino.network/guides/kyb" target="_blank">KYB</a>',
    })

    private verificationItems: VerificationItem[] = this.generateVerificationItems()

    $refs!: Record<string, ModalComponent | ModalComponent[]>

    get isKycVerified(): boolean {
        return this.$store.getters['Accounts/kycStatus']
    }

    get isKybVerified(): boolean {
        return this.$store.getters['Accounts/kybStatus']
    }

    get wallet(): WalletType | null {
        return this.$store.state.activeWallet
    }

    get isMultisig(): boolean {
        return this.wallet instanceof MultisigWallet
    }

    get shouldShowVerification(): boolean {
        return !this.isLedger && !!this.wallet
    }

    get isLedger(): boolean {
        const w = this.wallet
        return !!w && w.type === 'ledger'
    }

    openModal(type: 'kyc' | 'kyb', index: number): void {
        this.$nextTick(() => {
            const modalRef = this.getModalRef(type, index)
            if (modalRef) {
                modalRef.open()
            }
        })
    }

    getModalRef(type: 'kyc' | 'kyb', index: number): ModalComponent | undefined {
        const refKey = this.getModalRefKey(type, index)
        const refsArray = this.$refs[refKey] as ModalComponent[] | undefined
        return refsArray ? refsArray[0] : undefined
    }

    getModalRefKey(type: 'kyc' | 'kyb', index: number): string {
        return `${type}Modal_${index}`
    }

    isVerified(type: 'kyc' | 'kyb'): boolean {
        return type === 'kyc' ? this.isKycVerified : this.isKybVerified
    }

    private generateVerificationItems(): VerificationItem[] {
        const types: ('kyc' | 'kyb')[] = ['kyc', 'kyb']
        return types.map((type) => ({
            type,
            benefits: [
                this.$t('verify_wallet.verificationItems.benefits.opt1').toString(),
                this.$t('verify_wallet.verificationItems.benefits.opt2', {
                    type: type.toUpperCase(),
                }).toString(),
                this.$t('verify_wallet.verificationItems.benefits.opt3').toString(),
            ],
            modalComponent: type === 'kyc' ? KycModal : KybModal,
        }))
    }
}
</script>

<style scoped lang="scss">
@use '../styles/abstracts/mixins';

.verify-wallet--container {
    height: 100%;
    width: 100%;
    max-width: 1536px;
    margin-top: 6rem;

    h2,
    h3 {
        color: var(--primary-color);
        font-family: Inter;
        font-size: 16px;
        font-style: normal;
        font-weight: 600;
        line-height: 24px;
    }

    h2 {
        font-size: 20px;
        line-height: 32px;
    }

    .header {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding: 16px 24px;
        padding-left: 0;
        margin-top: 1rem;

        h1 {
            color: var(--primary-color);
            font-family: Inter;
            font-size: 28px;
            font-style: normal;
            font-weight: 600;
            line-height: 36px;
        }

        p {
            max-width: 50%;
            font-family: Inter;
            font-size: 14px;
            font-weight: 400;
            line-height: 20px;
            text-align: left;
            margin: 0 !important;
        }
    }

    .content {
        display: flex;
        flex-direction: column;
        gap: 3rem;
        padding: 16px 24px;
        padding-left: 0;

        &-item {
            display: flex;
            flex-direction: column;
            gap: 1rem;

            .v-icon {
                color: var(--primary-color);
                width: 20px;
                height: 20px;
                @include mixins.typography-subtitle-1;
            }
            .v-icon--check-decagram {
                color: var(--success);
            }

            &-action {
                display: flex;
                align-items: center;
                gap: 1rem;
            }

            &-list {
                list-style-type: none; /* Remove default bullets/dots */
                padding-left: 2rem;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;

                font-family: Inter;
                font-size: 14px;
                font-weight: 400;
                line-height: 20px;

                li {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
            }
        }
    }
}

@media only screen and (max-width: 600px) {
    .verify-wallet--container {
        .header {
            p {
                max-width: 100%;
            }
        }
    }
}
</style>
