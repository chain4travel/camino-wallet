<template>
    <div class="infoTx">
        <div class="utxos">
            <div v-if="hasReceived">
                <label>Receive</label>
                <BaseTxOutput
                    v-for="(asset, assetId) in tokensReceived"
                    :key="assetId"
                    :asset-i-d="assetId"
                    :summary="asset"
                    :chainPrefix="chainPrefix"
                ></BaseTxOutput>
                <div class="nft_cols">
                    <div class="nft_addr">
                        <p v-for="addr in summary.collectibles.received.addresses" :key="addr">
                            from {{ chainPrefix + addr }}
                        </p>
                    </div>
                    <div class="nft_fams">
                        <BaseTxNFTOutput
                            v-for="(asset, assetId) in summary.collectibles.received.assets"
                            :key="assetId"
                            :asset-i-d="assetId"
                            :summary="asset"
                            class="nft_out"
                        ></BaseTxNFTOutput>
                    </div>
                </div>
            </div>
            <div v-if="['deposit', 'unlock_deposit'].includes(type)">
                <label>{{ type == 'deposit' ? 'Deposit' : 'Undeposit' }}</label>
                <BaseTxOutput
                    v-for="(asset, assetId) in tokensDeposited"
                    :key="assetId"
                    :asset-i-d="assetId"
                    :summary="asset"
                    :isDeposit="true"
                    :chainPrefix="chainPrefix"
                ></BaseTxOutput>
            </div>
            <div v-if="hasSent">
                <label>Send</label>
                <BaseTxOutput
                    v-for="(asset, assetId) in tokensSent"
                    :key="assetId"
                    :asset-i-d="assetId"
                    :summary="asset"
                    :chainPrefix="chainPrefix"
                ></BaseTxOutput>
                <div class="nft_cols">
                    <div class="nft_addr">
                        <p v-for="addr in summary.collectibles.sent.addresses" :key="addr">
                            to {{ chainPrefix + addr }}
                        </p>
                    </div>
                    <div class="nft_fams">
                        <BaseTxNFTOutput
                            v-for="(asset, assetId) in summary.collectibles.sent.assets"
                            :key="assetId"
                            :asset-i-d="assetId"
                            :summary="asset"
                            class="nft_out"
                        ></BaseTxNFTOutput>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator'

import { ava } from '@/AVA'
import { ZeroBN } from '@/constants'
import { getTransactionSummary } from '@/helpers/history_helper'
import { WalletType } from '@/js/wallets/types'
import TxHistoryValue from '@/components/SidePanels/TxHistoryValue.vue'
import { TransactionValueDict } from '@/components/SidePanels/types'
import TxHistoryValueFunctional from '@/components/SidePanels/History/TxHistoryValueFunctional.vue'
import TxHistoryNftFamilyGroup from '@/components/SidePanels/TxHistoryNftFamilyGroup.vue'
import BaseTxOutput from '@/components/SidePanels/History/ViewTypes/BaseTxOutput.vue'
import BaseTxNFTOutput from '@/components/SidePanels/History/ViewTypes/BaseTxNFTOutput.vue'
import { ITransactionData, UTXO } from '@/store/modules/history/types'

import { Buffer } from '@c4tplatform/caminojs/dist'
import { DefaultPlatformChainID, PayloadBase, PayloadTypes } from '@c4tplatform/caminojs/dist/utils'

let payloadtypes = PayloadTypes.getInstance()

@Component({
    components: {
        BaseTxNFTOutput,
        BaseTxOutput,
        TxHistoryValue,
        TxHistoryValueFunctional,
        TxHistoryNftFamilyGroup,
    },
})
export default class BaseTx extends Vue {
    @Prop() transaction!: ITransactionData

    get summary() {
        let w = this.$store.state.activeWallet
        return getTransactionSummary(this.transaction, w)
    }

    get hasSent() {
        let numAssets = Object.keys(this.tokensSent).length
        let numNfts = Object.keys(this.summary.collectibles.sent.assets).length
        return numNfts + numAssets > 0
    }

    get hasReceived() {
        let numAssets = Object.keys(this.tokensReceived).length
        let numNfts = Object.keys(this.summary.collectibles.received.assets).length
        return numNfts + numAssets > 0
    }

    get addresses() {
        let wallet: WalletType | null = this.$store.state.activeWallet
        if (!wallet) return []

        return wallet.getHistoryAddresses()
    }

    get addrsRaw() {
        let addrs: string[] = this.addresses
        return addrs.map((addr) => addr.split('-')[1])
    }

    get type() {
        return this.transaction.type
    }

    get chainPrefix() {
        return this.transaction.chainID === DefaultPlatformChainID ? 'P-' : 'X-'
    }

    // What did I lose?
    get inValues() {
        let ins = this.transaction.inputs
        let res: TransactionValueDict = {} // asset id -> value dict

        // if empty
        if (!ins) {
            return res
        }

        ins.forEach((inputUtxo) => {
            const include = this.includeUtxo(inputUtxo.output, true)
            const assetId = inputUtxo.output.assetID
            const amt = inputUtxo.output.amount

            if (include) {
                if (res[assetId]) {
                    res[assetId] += parseInt(amt)
                } else {
                    res[assetId] = parseInt(amt)
                }
            }
        })

        return res
    }

    includeUtxo(utxo: UTXO, isInput?: boolean) {
        const isIncludes =
            utxo.addresses.filter((value) => this.addrsRaw.includes(value)).length > 0

        switch (this.transaction.type) {
            case 'export':
                return utxo.chainID === ava.XChain().getBlockchainID()
            case 'pvm_export':
                return utxo.chainID === ava.PChain().getBlockchainID()
            case 'pvm_import':
            case 'import':
                if (isInput) return false
                return isIncludes
            case 'add_validator':
            case 'add_delegator':
                return !isInput && utxo.stake
            case 'operation':
                // if no payload it is avax
                // check if it is from wallet
                if (!utxo.payload && !isIncludes) return false
                return true
            // default just return original logic
            // might need to be changed in the future as
            // more tx types are added
            case 'base':
            default:
                return isIncludes
        }

        return false
    }

    get tokensReceived() {
        let tokens = this.summary.tokens
        let res = {}
        for (var assetId in tokens) {
            let asset = tokens[assetId]
            if (asset.amount.gt(ZeroBN)) {
                //@ts-ignore
                res[assetId] = asset
            }
        }
        return res
    }

    get tokensDeposited() {
        let tokens = this.summary.tokens
        let res = {}
        for (var assetId in tokens) {
            let asset = tokens[assetId]
            if (asset.deposited.gt(ZeroBN)) {
                //@ts-ignore
                res[assetId] = asset
            }
        }
        return res
    }

    get tokensSent() {
        let tokens = this.summary.tokens
        let res = {}
        for (var assetId in tokens) {
            let asset = tokens[assetId]
            if (asset.amount.lt(ZeroBN)) {
                //@ts-ignore
                res[assetId] = asset
            }
        }
        return res
    }
    // what did I gain?
    get outValues() {
        let outs = this.transaction.outputs
        let res: TransactionValueDict = {} // asset id -> value dict

        // if empty
        if (!outs) {
            return res
        }

        outs.forEach((utxoOut) => {
            let assetId = utxoOut.assetID
            let amt = utxoOut.amount

            const include = this.includeUtxo(utxoOut)

            if (include) {
                if (res[assetId]) {
                    res[assetId] += parseInt(amt)
                } else {
                    res[assetId] = parseInt(amt)
                }
            }
        })

        return res
    }

    get valList() {
        let ins = this.inValues
        let outs = this.outValues
        let res = JSON.parse(JSON.stringify(outs))

        for (var assetId in ins) {
            let inAmount = ins[assetId] || 0
            if (res[assetId]) {
                res[assetId] -= inAmount
            } else {
                res[assetId] = -1 * inAmount
            }
        }

        return res
    }

    get nftGroups() {
        let ins = this.transaction.inputs
        let outs = this.transaction.outputs
        let res: { [key in string]: { [key in string]: PayloadBase[] } } = {}

        // res = {
        //     'asset id': { ['group id']: 'payload' },
        // }

        const pushPayload = (rawPayload: string, assetID: string, groupID: number) => {
            let payload = Buffer.from(rawPayload, 'base64')
            payload = Buffer.concat([new Buffer(4).fill(payload.length), payload])

            try {
                let typeId = payloadtypes.getTypeID(payload)
                let pl: Buffer = payloadtypes.getContent(payload)
                let payloadbase: PayloadBase = payloadtypes.select(typeId, pl)

                if (res[assetID]) {
                    if (res[assetID][groupID]) {
                        res[assetID][groupID].push(payloadbase)
                    } else {
                        res[assetID] = {
                            [groupID]: [payloadbase],
                        }
                    }
                } else {
                    res[assetID] = {
                        [groupID]: [payloadbase],
                    }
                }
            } catch (e) {
                // console.error(e)
            }
        }

        if (ins) {
            ins.forEach((inputUtxo) => {
                const groupID = inputUtxo.output.groupID
                const assetID = inputUtxo.output.assetID

                if (inputUtxo.output.payload) {
                    pushPayload(inputUtxo.output.payload, assetID, groupID)
                }
            })
        }

        if (outs) {
            outs.forEach((utxoOut) => {
                let groupID = utxoOut.groupID
                let assetID = utxoOut.assetID

                if (utxoOut.payload) {
                    pushPayload(utxoOut.payload, assetID, groupID)
                }
            })
        }

        return res
    }

    get operationDirection() {
        if (this.type !== 'operation') return 'N/A'

        let addrs: string[] = this.addresses
        let addrsRaw = addrs.map((addr) => addr.split('-')[1])

        let ins = this.transaction.inputs || []
        const isFromWallet = ins.find((input) => {
            return input.output.addresses.find((value) => {
                return addrsRaw.includes(value)
            })
        })

        return isFromWallet ? 'Send' : 'Receive'
    }

    get operationColor() {
        return this.operationDirection === 'Receive' ? 'success' : 'sent'
    }
}
</script>
<style scoped lang="scss">
@use '../../../../styles/abstracts/mixins';
label {
    @include mixins.typography-caption;
    color: var(--primary-color-light);
}
.nfts {
    display: flex;
    flex-wrap: wrap;
    margin-top: 5px;
    justify-content: flex-end;
    > div {
        margin-left: 5px;
    }
}

.nft_cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
}
.nft_addr {
    display: flex;
    flex-direction: column;
    justify-content: center;
    @include mixins.typography-caption;
    color: var(--primary-color-light);
    overflow: hidden;
    font-family: var(--primary-font);
    white-space: nowrap;

    p {
        overflow: hidden;
        text-overflow: ellipsis;
    }
}
.nft_fams {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.nft_out {
    margin-bottom: 4px;
}
</style>
