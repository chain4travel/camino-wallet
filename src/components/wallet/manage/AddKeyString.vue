<template>
    <div>
        <label>{{ $t('private_key') }}</label>
        <form @submit.prevent="addKey">
            <qr-input @change="validateQR" v-model="privateKeyInput" class="qrIn"></qr-input>
            <p class="err">{{ error }}</p>
            <v-btn
                type="submit"
                :loading="isLoading"
                :disabled="!canAdd"
                class="addKeyBut button_primary ava_button"
                depressed
                block
            >
                {{ $t('add_pk') }}
            </v-btn>
        </form>
    </div>
</template>
<script lang="ts">
import 'reflect-metadata'
import { Vue, Component } from 'vue-property-decorator'
// @ts-ignore
import { QrInput } from '@c4tplatform/vue_components'
import Spinner from '@/components/misc/Spinner.vue'

@Component({
    components: {
        QrInput,
        Spinner,
    },
})
export default class AddKeyString extends Vue {
    privateKeyInput: string = ''
    canAdd: boolean = false
    error: string = ''
    isLoading: boolean = false

    validateQR(val: string) {
        if (this.privateKeyInput.length > 10) {
            this.canAdd = true
        } else if (this.privateKeyInput.length === 0) {
            this.error = ''
            this.canAdd = false
        } else {
            this.canAdd = false
        }
    }

    addKey() {
        this.isLoading = true
        this.error = ''

        setTimeout(async () => {
            try {
                await this.$store.dispatch('addWalletSingleton', { key: this.privateKeyInput })
                // @ts-ignore
                this.$emit('success')
                this.clear()
            } catch (e: any) {
                this.isLoading = false

                if (e.message.includes('already')) {
                    this.error = this.$t('keys.import_key_duplicate_err') as string
                } else {
                    this.error = this.$t('keys.import_key_err') as string
                }
                console.error(e)
            }
        }, 200)
    }

    clear() {
        this.isLoading = false
        this.privateKeyInput = ''
        this.canAdd = false
        this.error = ''
    }
}
</script>
<style scoped lang="scss">
@use '../../../styles/abstracts/mixins';
label {
    color: #909090;
    @include mixins.typography-caption;
}

.qrIn {
    border-radius: 2px !important;
    height: 40px;
    @include mixins.typography-caption;
    background-color: #f5f6fa;
}

.err {
    color: var(--error);
}
</style>
