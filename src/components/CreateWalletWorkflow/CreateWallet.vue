<template>
    <div class="create_wallet">
        <div class="container">
            <div class="row">
                <div class="col">
                    <transition name="fade" mode="out-in">
                        <!-- PHASE 1 -->
                        <div v-if="!keyPhrase" class="stage_1">
                            <div class="img_container">
                                <img src="@/assets/diamond-secondary-night.svg" alt="diamond" />
                            </div>
                            <h1>{{ $t('create.generate') }}</h1>
                            <div @click="navigate('/login')" class="link">
                                {{ $t('create.but_have') }}
                            </div>
                            <div class="options">
                                <CamBtn
                                    variant="primary"
                                    @click="createKey"
                                    data-cy="btn-generate-key-phrase"
                                >
                                    {{ $t('create.submit') }}
                                </CamBtn>
                                <!--                                <TorusGoogle class="torus_but"></TorusGoogle>-->
                            </div>
                            <ToS></ToS>

                            <div @click="navigate('/login')" class="link">
                                {{ $t('create.cancel') }}
                            </div>
                        </div>
                        <!-- PHASE 2 -->
                        <div v-else class="stage_2">
                            <div class="cols">
                                <!-- LEFT -->
                                <div class="mneumonic_disp_col">
                                    <div class="mnemonic_disp">
                                        <!-- <mnemonic-display
                                            :phrase="keyPhrase.getValue()"
                                            :bgColor="verificatiionColor"
                                            class="mnemonic_display"
                                        ></mnemonic-display> -->
                                        <p
                                            data-cy="phrase-raw-created"
                                            class="phrase_raw"
                                            v-bind:class="{
                                                verified: isVerified,
                                            }"
                                        >
                                            {{ keyPhrase.getValue() }}
                                        </p>
                                        <div class="mneumonic_button_container" v-if="!isVerified">
                                            <CamBtn @click="createKey" variant="primary">
                                                <fa icon="sync"></fa>
                                                <span>{{ $t('create.regenerate') }}</span>
                                            </CamBtn>
                                        </div>
                                    </div>
                                </div>
                                <!-- RIGHT -->
                                <div class="phrase_disp_col">
                                    <template v-if="!isVerified">
                                        <img
                                            v-if="$store.state.theme === 'dark'"
                                            src="@/assets/keyphrase.png"
                                            alt=""
                                        />
                                        <img v-else src="@/assets/keyphrase_night.svg" alt="" />
                                    </template>
                                    <template v-else>
                                        <img src="@/assets/success.svg" alt="" />
                                    </template>
                                    <header v-if="!isVerified">
                                        <h1>
                                            {{ $t('create.mnemonic_title') }}
                                        </h1>
                                        <p>{{ $t('create.mnemonic_desc') }}</p>
                                    </header>
                                    <header v-else>
                                        <h1>
                                            {{ $t('create.success_title') }}
                                        </h1>
                                        <p>{{ $t('create.success_desc') }}</p>
                                    </header>
                                    <Alert variant="warning" v-if="!isVerified">
                                        {{ $t('create.warning') }}
                                    </Alert>
                                    <!-- STEP 2a - VERIFY -->
                                    <div class="verify_cont" v-if="!isVerified">
                                        <MnemonicCopied
                                            data-cy="checkbox-wrote-key-phrase-secure-location"
                                            v-model="isSecured"
                                            :explain="$t('create.confirm')"
                                        ></MnemonicCopied>
                                        <VerifyMnemonic
                                            :mnemonic="keyPhrase"
                                            ref="verify"
                                            @complete="complete"
                                        ></VerifyMnemonic>
                                        <CamBtn
                                            variant="primary"
                                            class="ml-auto"
                                            @click="verifyMnemonic"
                                            :disabled="!canVerify"
                                            data-cy="btn-verify-mnemonic"
                                        >
                                            {{ $t('create.success_submit') }}
                                        </CamBtn>
                                    </div>
                                    <!-- STEP 2b - ACCESS -->
                                    <div class="access_cont" v-if="isVerified">
                                        <transition name="fade" mode="out-in">
                                            <Spinner v-if="isLoad" class="spinner"></Spinner>
                                            <div class="access_btns" v-else>
                                                <CamBtn
                                                    variant="transparent"
                                                    @click="navigate('/login')"
                                                >
                                                    {{ $t('create.cancel') }}
                                                </CamBtn>
                                                <CamBtn
                                                    variant="primary"
                                                    @click="access"
                                                    :disabled="!canSubmit"
                                                    data-cy="btn-success-mnemonic"
                                                >
                                                    {{ $t('create.success_submit') }}
                                                </CamBtn>
                                            </div>
                                            <ToS style="margin: 30px 0 !important"></ToS>
                                        </transition>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </transition>
                </div>
            </div>
        </div>
        <div></div>
    </div>
</template>
<script lang="ts">
import 'reflect-metadata'
import { Component, Vue, Watch } from 'vue-property-decorator'
import Spinner from '@/components/misc/Spinner.vue'
import * as bip39 from 'bip39'

import VerifyMnemonic from '@/components/modals/VerifyMnemonic.vue'
import MnemonicCopied from '@/components/CreateWalletWorkflow/MnemonicCopied.vue'
import ToS from '@/components/misc/ToS.vue'
import MnemonicPhrase from '@/js/wallets/MnemonicPhrase'
import Alert from '@/components/Alert.vue'
import CamBtn from '@/components/CamBtn.vue'

@Component({
    components: {
        ToS,
        Spinner,
        VerifyMnemonic,
        MnemonicCopied,
        CamBtn,
        Alert,
    },
})
export default class CreateWallet extends Vue {
    // TODO: We do not need to create keyPair, only mnemonic is sufficient
    isLoad: boolean = false
    keyPhrase: MnemonicPhrase | null = null
    isSecured: boolean = false
    isVerified: boolean = false
    // @ts-ignore
    helpers = this.globalHelper()
    navigate(to: string) {
        this.helpers.navigate(to)
    }
    get canVerify(): boolean {
        return this.isSecured ? true : false
    }

    get verificatiionColor() {
        return this.isVerified ? '#a9efbf' : '#F5F6FA'
    }

    createKey(): void {
        this.isSecured = false
        let mnemonic = bip39.generateMnemonic(256)
        this.keyPhrase = new MnemonicPhrase(mnemonic)
    }

    // Will be true if the values in remember wallet checkbox are valid
    // isRememberValid(val: boolean){
    //     this.rememberValid = val;
    // }

    get canSubmit(): boolean {
        // if(!this.rememberValid) return false;
        return true
    }
    verifyMnemonic() {
        // @ts-ignore
        this.$refs.verify.open()
    }

    complete() {
        this.isVerified = true
    }

    async access(): Promise<void> {
        if (!this.keyPhrase) return

        this.isLoad = true
        await this.$store.dispatch('accessWallet', this.keyPhrase!.getValue())
        this.helpers.updateSuiteStore(this.$store.state)
    }
}
</script>
<style scoped lang="scss">
@use '../../styles/abstracts/mixins';
@use '../../styles/abstracts/variables';

.create_wallet {
    display: flex;
    justify-content: center;
    align-items: center;
}

/* ==========================================
   stage_1
   ========================================== */

.stage_1 {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-light);
    padding: variables.$container-padding;
    border-radius: 1rem;
    text-align: center;
    /*min-width: 1000px;*/

    img {
        margin-top: variables.$vertical-padding;
        width: 89px;
        height: 89px;
        max-height: none;
    }

    h1 {
        margin-top: variables.$vertical-padding;
        text-align: left;
        @include mixins.typography-subtitle-1;
        font-weight: 400;
    }
}

.options {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin: 15px;
    padding-top: 15px;

    > * {
        margin: 4px;
        @include mixins.typography-caption;
    }

    p {
        color: #999;
        margin: 6px !important;
    }
}

.torus_but {
    background-color: #db3236;
    color: #fff;
}

.but_generate {
    display: block;
    height: max-content;
    background-color: variables.$secondary-color;
}

.key_disp {
    margin: 30px auto;
    @include mixins.typography-caption;
}

a {
    color: variables.$primary-color-light !important;
    text-decoration: underline !important;
    margin-top: 10px;
}

/* ==========================================
   mneumonic
   ========================================== */

.stage_2 {
    margin: 0 auto;
    text-align: left;
    align-items: flex-start;
}

.cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 60px;
}

.mneumonic_disp_col {
    .mnemonic_disp {
        max-width: 560px;
        justify-self: center;
        display: flex;
        flex-direction: column;
    }

    .phrase_raw {
        color: var(--primary-color);
        background-color: var(--bg-light);
        padding: 14px 24px;
        text-align: justify;
        border-radius: var(--border-radius-sm);
        margin: 30px 0px !important;
    }

    .mnemonic_display {
        background-color: var(--bg-light);
        padding: 14px;
    }

    .verified {
        background-color: variables.$green-light;
        color: #222;
    }

    .mneumonic_button_container {
        margin-left: auto;
        .but_randomize {
            span {
                margin-left: 12px;
            }
        }
    }
}

.phrase_disp_col {
    padding: 0 30px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 8px;

    > * {
        width: 100%;
    }

    img {
        width: variables.$img-size;
        height: variables.$img-size;
        max-height: none;
    }

    header {
        h1 {
            margin-top: 10px;
            @include mixins.typography-headline-1;
        }

        p {
            color: variables.$primary-color-light;
        }
    }

    .warn {
        margin-top: variables.$vertical-padding !important;

        span {
            display: block;
            @include mixins.typography-caption;
            text-transform: uppercase;

            &.label {
                color: variables.$secondary-color;
                text-transform: uppercase;
            }

            &.description {
                color: variables.$primary-color-light !important;
            }
        }
    }

    .verify_cont {
        display: flex;
        flex-direction: column;
        margin-top: 8px;
        gap: 8px;
    }

    .access_cont {
        text-align: left;
        flex-direction: column;

        .submit {
            display: flex;
            flex-direction: row;
            margin-top: 14px;
            text-align: left;
        }
    }
}

.access_btns {
    display: flex;
    flex-direction: row;
    gap: var(--spacing-space-sm);
    margin-left: auto;
    width: fit-content;
}

.ml-auto {
    margin-left: auto;
}

.spinner {
    width: 26px !important;
    margin: 0px auto;
}

.remember_wallet {
    margin: 20px 0;
}

@include mixins.medium-device {
    .stage_1 {
        min-width: unset;
    }
}

@include mixins.mobile-device {
    .stage_1 {
        min-width: unset;
    }

    .stage_2 {
        min-width: unset;
    }

    .access {
        margin: 30px auto;
        width: 100%;
    }

    .cols {
        display: block;
    }

    .options {
        margin: 30px 0px;
        flex-direction: column;

        > button {
            width: 100%;
        }
    }

    .mneumonic_disp_col {
        .mnemonic_disp {
            margin: 0 auto;
        }

        .mneumonic_button_container {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;

            .copy_phrase {
                margin-right: 0;
                width: 100%;
                display: flex;
                flex-direction: row;
                justify-content: center;
            }

            .but_randomize {
                margin-top: 10px;

                span {
                    margin-left: 12px;
                }
            }
        }
    }

    .phrase_disp_col {
        padding: 30px 0;
        align-items: center;

        img {
            width: variables.$img-size-mobile;
            height: variables.$img-size-mobile;
        }

        header {
            h1 {
                @include mixins.typography-headline-4;
            }
        }

        .warn {
            margin-top: variables.$vertical-padding-mobile !important;
        }

        .access_cont {
            .submit {
                flex-direction: column;
                justify-content: center;

                > div {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                }

                .link {
                    margin: auto;
                }
            }
        }
    }
}
.confirm-cancel-link {
    position: relative;
    top: 10px;
}

.div-button-access-and-cancel {
    position: relative;
    align-items: center;
    text-align: center;
}
</style>
<style lang="scss">
.create_wallet {
    .remember_wallet {
        .v-expansion-panel-header,
        .v-expansion-panel-content__wrap {
            padding: 6px 0;
        }
    }
}
</style>
