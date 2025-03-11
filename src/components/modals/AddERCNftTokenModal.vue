<template>
    <modal ref="modal" title="Add Collectible" @beforeClose="beforeClose">
        <div class="add_token_body">
            <div>
                <label>ERCNft Contract Address</label>
                <input v-model="tokenAddress" placeholder="0x" />
                <p class="err">{{ err }}</p>
            </div>

            <div class="meta" :found="canAdd">
                <div>
                    <label>Collectible Name</label>
                    <input v-model="name" disabled />
                </div>
                <div>
                    <label>Collectible Symbol</label>
                    <input v-model="symbol" disabled />
                </div>
            </div>

            <v-btn class="button_secondary" block depressed :disabled="!canAdd" @click="submit">
                Add Collectible
            </v-btn>
            <div class="already_added" v-if="networkTokens.length">
                <h4>Already added</h4>
                <div v-for="token in networkTokens" :key="token.data.address" class="flex-row">
                    <div class="flex-column" style="flex-grow: 1">
                        <p>{{ token.data.name }} {{ token.data.symbol }}</p>
                        <p class="subtext">{{ token.data.address }}</p>
                    </div>
                    <button @click="removeToken(token)"><fa icon="times"></fa></button>
                </div>
            </div>
        </div>
    </modal>
</template>
<script lang="ts">
import 'reflect-metadata'
import { Vue, Component, Watch } from 'vue-property-decorator'
import axios from 'axios'

import Modal from './Modal.vue'
import { AbiItem, web3 } from '@/evm'
import IERCNftAbi from '@/abi/IERC721MetaData.json'
import IERC1155Abi from '@/abi/IERC1155MetaData.json'
import { ERCNftTokenInput } from '@/store/modules/assets/modules/types'
import ERCNftToken, { ERC721ID, ERC1155ID } from '@/js/ERCNftToken'
import { CF_IPFS_BASE } from '@/constants'

@Component({
    components: {
        Modal,
    },
})
export default class AddERCNftTokenModal extends Vue {
    tokenAddress = ''
    name = ''
    symbol = ''
    canAdd = false
    err = ''

    @Watch('tokenAddress')
    async onAddressChange(val: string) {
        this.err = ''
        if (val === '') {
            this.clear()
            return
        }
        await this.validateAddress(val)
    }

    async validateAddress(val: string) {
        if (val === '') {
            this.err = ''
            return false
        }

        const IPFS_GATEWAYS = [
            'https://gateway.pinata.cloud/ipfs/',
            'https://ipfs.io/ipfs/',
            'https://cloudflare-ipfs.com/ipfs/',
        ]

        async function fetchWithFallback(uri: string) {
            if (!uri.startsWith('ipfs://')) return axios.get(uri)

            const ipfsHash = uri.substring(7)
            for (const gateway of IPFS_GATEWAYS) {
                try {
                    return await axios.get(gateway + ipfsHash)
                } catch (e) {
                    if (gateway === IPFS_GATEWAYS[IPFS_GATEWAYS.length - 1]) throw e
                    continue
                }
            }
        }

        try {
            let tokenInst = new web3.eth.Contract(IERCNftAbi as AbiItem[], val)

            const isErc721 = await tokenInst.methods.supportsInterface(ERC721ID).call()
            if (isErc721) {
                const name = await tokenInst.methods.name().call()
                const symbol = await tokenInst.methods.symbol().call()

                this.symbol = symbol
                this.name = name
                this.canAdd = true
                return true
            }

            const isErc1155 = await tokenInst.methods.supportsInterface(ERC1155ID).call()
            if (isErc1155) {
                tokenInst = new web3.eth.Contract(IERC1155Abi as AbiItem[], val)

                const tokenIds = [0, 1, 2]
                for (const tokenId of tokenIds) {
                    try {
                        const metadataUri = await tokenInst.methods.uri(tokenId).call()

                        const tokenIdHex = web3.utils
                            .padLeft(web3.utils.toHex(tokenId), 64)
                            .replace('0x', '')
                        const uri = metadataUri?.includes('{id}')
                            ? metadataUri.replace('{id}', tokenIdHex)
                            : metadataUri

                        const metadata = await fetchWithFallback(uri)

                        if (metadata?.data) {
                            this.name = metadata.data.name || '-'
                            this.symbol = metadata.data.symbol || '-'
                            this.canAdd = true
                            return true
                        }
                    } catch (err) {
                        continue
                    }
                }

                throw new Error('No valid metadata found for tested token IDs')
            }

            throw new Error('Contract does not support ERC721 or ERC1155')
        } catch (e) {
            this.canAdd = false
            this.symbol = '-'
            this.name = '-'
            this.err = 'Invalid contract address or metadata.'
            return false
        }
    }

    clear() {
        this.tokenAddress = ''
        this.canAdd = false
        this.symbol = '-'
        this.name = '-'
        this.err = ''
    }

    async submit() {
        try {
            let data: ERCNftTokenInput = {
                type: undefined,
                address: web3.utils.toChecksumAddress(this.tokenAddress),
                name: this.name,
                symbol: this.symbol,
                chainId: this.$store.state.Assets.evmChainId,
                ercTokenIds: [],
            }

            let token: ERCNftToken = await this.$store.dispatch('Assets/ERCNft/addCustom', data)
            let { dispatchNotification } = this.globalHelper()
            dispatchNotification({
                message: this.$t('notifications.ERCNft_token_added'),
                type: 'success',
            })
            this.close()
        } catch (e) {
            this.err = (e as Error).message
            console.error(e)
        }
    }

    beforeClose() {
        this.clear()
    }

    open() {
        // @ts-ignore
        this.$refs.modal.open()
    }

    close() {
        // @ts-ignore
        this.$refs.modal.close()
    }

    async removeToken(token: ERCNftToken) {
        await this.$store.dispatch('Assets/ERCNft/removeCustom', token)
    }

    get networkTokens(): ERCNftToken[] {
        return this.$store.getters['Assets/ERCNft/networkContractsCustom']
    }
}
</script>
<style scoped lang="scss">
@use '../../styles/abstracts/mixins';

.add_token_body {
    padding: 30px 22px;
    text-align: center;
    width: 380px;
    max-width: 100%;

    > div {
        &:first-of-type {
            margin-bottom: 14px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--bg-light);
        }
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
    }

    label {
        @include mixins.typography-caption;
    }
    input {
        width: 100%;
        background-color: var(--bg-light);
        padding: 14px 24px;
        border-radius: 3px;
        @include mixins.typography-caption;
        color: var(--primary-color);
    }

    > * {
        margin: 6px 0;
    }
}

.meta {
    text-align: left;
    background-color: var(--bg-light);
    opacity: 0.6;
    transition-duration: 0.3s;

    > div {
        border-bottom: 1px solid var(--bg);
        padding: 14px 24px;
    }

    label {
        color: var(--primary-color-light);
    }
    input {
        padding: 0;
        color: var(--primary-color);
    }
}

.meta[found] {
    opacity: 1;
}

.err {
    width: 100%;
    text-align: center;
}

.already_added {
    text-align: left;
    margin-top: 1em;

    h4 {
        text-align: center;
        margin: 0px auto;
    }
    > div {
        width: 100%;
        align-items: center;
        margin: 3px 0;

        button {
            align-self: baseline;
            @include mixins.typography-caption;
            opacity: 0.5;

            &:hover {
                opacity: 1;
            }
        }
    }
}

@include mixins.mobile-device {
    .add_token_body {
        width: 100%;
    }
}
</style>
