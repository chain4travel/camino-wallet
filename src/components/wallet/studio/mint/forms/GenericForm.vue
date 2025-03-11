<template>
    <div>
        <div class="input_cont">
            <label>{{ $t('studio.mint.forms.generic.label1') }}</label>
            <CamInput class="text" max="128" v-model="title" @input="onInput" />
        </div>
        <div class="input_cont">
            <label>{{ $t('studio.mint.forms.generic.label2') }}</label>
            <CamInput class="text" placeholder="https://" v-model="imgUrl" @input="onInput" />
        </div>

        <div class="input_cont">
            <label>{{ $t('studio.mint.forms.generic.label3') }}</label>
            <CamInput
                class="text"
                maxlength="256"
                v-model="description"
                @input="onInput"
                :textArea="true"
            />
        </div>
        <p v-if="errors.length" class="err">
            <span v-for="(error, index) in errors" :key="index">{{ error }}</span>
        </p>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { GenericFormType, IGenericNft } from '@/components/wallet/studio/mint/types'
import CamInput from '@/components/CamInput.vue'

@Component({
    components: {
        CamInput,
    },
})
export default class GenericForm extends Vue {
    title = ''
    description = ''
    imgUrl = ''
    errors: string[] = []
    imageUrl = ''

    async checkUrlType(url: URL) {
        try {
            const response = await fetch(url.toString(), { method: 'HEAD' })
            const contentType = response.headers.get('content-type') || ''

            if (contentType.includes('application/json')) {
                await this.fetchJsonMetadata(url)
            } else if (contentType.startsWith('image/')) {
                this.imageUrl = this.imgUrl
            } else {
                throw new Error('Unsupported content type')
            }
        } catch (error) {
            this.errors.push(this.$t('studio.mint.forms.generic.errInvalidUrl') as string)
        }
    }

    async validate() {
        this.errors = []
        this.imageUrl = ''

        if (!this.imgUrl) {
            this.errors.push(this.$t('studio.mint.forms.generic.err2') as string)
        } else {
            try {
                const url = new URL(this.imgUrl)

                await this.checkUrlType(url)

                if (this.imgUrl.length > 516) {
                    this.errors.push(this.$t('studio.mint.forms.generic.err3') as string)
                }
            } catch {
                this.errors.push(this.$t('studio.mint.forms.generic.err1') as string)
            }
        }

        return this.errors.length === 0
    }

    async fetchJsonMetadata(url: URL) {
        try {
            const response = await fetch(url.toString())
            const metadata = await response.json()

            if (metadata.image) {
                this.imageUrl = metadata.image
            } else {
                throw new Error('Missing image field in metadata')
            }
        } catch (error) {
            this.errors.push(this.$t('studio.mint.forms.generic.errInvalidJson') as string)
        }
    }

    async onInput() {
        this.errors = []
        let msg: null | GenericFormType = null
        if (await this.validate()) {
            const data: IGenericNft = {
                version: 1,
                type: 'generic',
                title: this.title,
                img: this.imageUrl,
                desc: this.description,
            }
            msg = { data: { avalanche: data } }
        }

        this.$emit('onInput', msg)
    }
}
</script>

<style scoped lang="scss">
@use '../../../../../styles/abstracts/mixins';

.input_cont {
    margin-top: 2px;
    width: 100%;

    input {
        width: 100%;
    }
}
.image-preview {
    margin: 10px 0;

    img {
        max-width: 100%;
        height: auto;
        border: 1px solid #ccc;
        border-radius: 8px;
    }
}
.v-btn {
    margin-top: 14px;
}
.counter {
    text-align: right;
    @include mixins.typography-caption;
    color: var(--primary-color-light);
    padding: 2px;
}
.err {
    color: red;
    margin-top: 10px;
}
</style>
