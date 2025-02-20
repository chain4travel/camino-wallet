<template>
    <div>
        <Modal
            ref="modal"
            :title="$t('kyc_process.title')"
            class="modal_main"
            @beforeClose="beforeClose"
        >
            <div v-if="!userDataSubmitted" class="KYCform">
                <div class="request-text">
                    {{ $t('kyc_process.info_explanation_p1') }}
                    <br />
                    {{ $t('kyc_process.info_explanation_p2') }}
                </div>
                <div class="form__container">
                    <div>
                        <label>{{ $t('kyc_process.your_email_address') }}</label>
                        <cam-input
                            :placeholder="$t('kyc_process.email_address')"
                            v-model="userData.email"
                        ></cam-input>
                    </div>
                    <div>
                        <label>{{ $t('kyc_process.your_phone_number') }}</label>
                        <cam-input
                            :placeholder="$t('kyc_process.phone_number')"
                            v-model="userData.phone"
                        ></cam-input>
                    </div>
                    <cam-btn
                        variant="primary"
                        :disabled="submitUserDataDisabled"
                        :loading="isLoading"
                        @click="submitUserData"
                    >
                        {{ $t('kyc_process.submit') }}
                    </cam-btn>
                </div>
            </div>
            <div id="sumsub-websdk-container"></div>
            <div v-if="verficationCompleted" class="kyc_action">
                <v-btn type="cancel" @click="close" class="outlined_button">Close</v-btn>
            </div>
        </Modal>
    </div>
</template>
<script lang="ts">
import Modal from '@/components/modals/Modal.vue'
import { KYC_VARIANT, kycStyleDay, kycStyleNight } from '@/constants'
import MnemonicWallet from '@/js/wallets/MnemonicWallet'
import { SingletonWallet } from '@/js/wallets/SingletonWallet'
import { WalletNameType, WalletType } from '@/js/wallets/types'
import { generateToken } from '@/kyc_api'
import snsWebSdk from '@sumsub/websdk'
import 'reflect-metadata'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import CamBtn from '../CamBtn.vue'
import CamInput from '../CamInput.vue'
interface UserData {
    email: string
    phone: string
}

@Component({
    components: {
        Modal,
        CamBtn,
        CamInput,
    },
})
export default class KycModal extends Vue {
    @Prop() walle!: WalletType
    $refs!: {
        modal: Modal
    }
    /**/
    modalLight: string = '#FFF'
    modalDark: string = '#242729'
    background: string = 'body {background-color: red !important;}'
    verficationCompleted: boolean = false
    /**/
    userDataSubmitted: boolean = false
    isLoading: boolean = false
    userData: UserData = {
        email: '',
        phone: '',
    }
    @Watch('themeSelected', { immediate: true })
    onthemechange(val: string) {
        if (val === 'dark') {
            this.background = kycStyleNight
        } else {
            this.background = kycStyleDay
        }
    }
    get walletType(): WalletNameType {
        return this.wallet.type
    }
    get themeSelected(): string {
        return this.$store.state.theme
    }
    get privateKeyC(): string | null {
        if (this.walletType === 'ledger') return null
        let wallet = this.wallet as SingletonWallet | MnemonicWallet
        return wallet.ethKey
    }
    get submitUserDataDisabled() {
        return !this.userData.email || !this.userData.phone || this.isLoading
    }

    launchWebSdk(accessToken: string, applicantEmail: any, applicantPhone: any) {
        let snsWebSdkInstance = snsWebSdk
            .init(accessToken, () => this.getNewAccessToken())
            .withConf({
                email: applicantEmail,
                phone: applicantPhone,
                uiConf: {
                    customCssStr: this.background,
                },
            })
            .withOptions({ addViewportTag: false, adaptIframeHeight: true })
            .on('idCheck.applicantStatus', async (applicantStatus) => {
                await this.$store.dispatch('Accounts/updateKycStatus')
                if (applicantStatus.reviewStatus === 'completed') {
                    this.verficationCompleted = true
                }
            })
            .build()
        snsWebSdkInstance.launch('#sumsub-websdk-container')
    }

    async getNewAccessToken() {
        if (this.privateKeyC) {
            const result = await generateToken(this.privateKeyC, KYC_VARIANT.KYC_BASIC)
            return result.access_token
        }
        return ''
    }

    get wallet() {
        let wallet: MnemonicWallet = this.$store.state.activeWallet
        return wallet
    }

    async submitUserData() {
        if (!this.userData.email || !this.userData.phone) return
        try {
            this.isLoading = true
            const accessToken = await this.getNewAccessToken()
            this.launchWebSdk(accessToken, this.userData.email, this.userData.phone)
            this.userDataSubmitted = true
        } finally {
            this.isLoading = false
        }
    }

    async open() {
        this.$refs.modal.open()
    }

    async close() {
        await this.$store.dispatch('Accounts/updateKycStatus')
        this.$refs.modal.close()
    }

    beforeClose() {
        this.userDataSubmitted = false
        if (this.globalHelper().closeSelect) this.globalHelper().closeSelect()
        this.userData = {
            email: '',
            phone: '',
        }
    }
}
</script>
<style scoped lang="scss">
@use '../../styles/abstracts/mixins';

.modal_main::v-deep {
    .modal_body {
        width: 70%;
        max-width: 750px;
        height: min-content !important;
        /* min-height: 450px !important; */
        border-radius: var(--border-radius-sm) !important;
        overflow: auto;
        min-height: 200px;
        @include mixins.mobile-device {
            max-height: 90vh;
            max-width: none;
            width: 80%;
            min-height: fit-content;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
        }
    }

    .modal_bg {
        width: 100vw !important;
        position: fixed;
    }
}

h1 {
    font-weight: normal;
}

.outlined_button {
    border-width: 1px;
    border-style: solid;
    border-radius: var(--border-radius-sm);
    padding: 10px 24px;
    border-color: var(--primary-btn-border-color);
    color: var(--primary-btn-border-color);
    background-color: var(--bg) !important;
    height: auto;
}

.kyc_action {
    display: flex;
    background-color: var(--bg);
    border-bottom: var(--bg);
    color: var(--primary-color);
    border-top: 2px solid var(--bg-light);
    position: relative;
    padding: 16px 22px;
}
.KYCform {
    padding: 20px;
    border-radius: var(--border-radius-sm);
    overflow: auto;
    .request-text {
        padding: 1rem;
        text-align: center;
        color: var(--primary-contrast-text);
        border-radius: var(--border-radius-sm);
        margin-bottom: 25px;
        border: 2px solid var(--border-color);
        border-radius: var(--border-radius-lg);
    }
    .form__container {
        display: grid;
        gap: 10px;
        label {
            @include mixins.typography-caption;
            margin-bottom: 10px !important;
            color: var(--primary-contrast-text);
        }
        > div {
            display: flex;
            flex-direction: column;
            margin-bottom: 5px;
        }
    }
}

.popup {
    background: #1e293b;
}
.popup .message-content p {
    color: #f5f5f5;
}

/* .document-status {
    background-color: transparent !important;
} */
/* .steps {
}
.step .activ {
}

.step.active .line {
    background-color: red;
}
.bullet::before {
    background-color: black;
}
.title {
    color: white;
}

.step .title {
    color: #f5f5f5;
}
.step.active .title {
    color: #149ded;
} */
/* button.submit,
button[type='submit'] {
    border-radius: 12px;
    background-color: transparent;
    background-image: none;
    color: #149ded;
    border: 1px solid #149ded;
}
.upload-payment-item .upload-item {
    border: 1px solid rgba(203, 213, 225, 0.12);
    border-radius: 7px;
    box-shadow: rgb(0 0 0 / 10%) 0px 0px 5px;
    background-color: var(--white-color);
}

section {
    border-radius: 7px;
    box-shadow: rgb(0 0 0 / 10%) 0px 0px 5px;
    background-color: #1e293b;
} */
.step.active.pending .bullet:before {
    background-color: var(--orange-color);
}
.line-form .line-form-item > .phone-input,
.line-form .line-form-item > input {
    color: red;
}
.line-form .line-form-item > span {
    border-bottom: none;
}

button {
    border-radius: 12px;
    background-color: transparent;
    font-weight: 600;
    text-align: center;
    color: #7c8ab5;
    border: 1px solid #149ded;
}
input {
    color: var(--primary-color);
    background-color: var(--bg-light);
    border-radius: var(--border-radius-sm);
    padding: 10px 10px;
    @include mixins.typography-caption;
    outline: none;
}

/* .step.pending .bullet {
    background-color: #0f172a;
    background-image: none;
    border-color: #0f172a;
} */
</style>
