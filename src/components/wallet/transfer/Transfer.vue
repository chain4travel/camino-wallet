<template>
    <div class="transfer_card">
        <!--        <h1>{{ $t('transfer.title') }}</h1>-->
        <div v-if="networkStatus !== 'connected'" class="disconnected">
            <p>{{ $t('transfer.disconnected') }}</p>
        </div>
        <div class="card_body" v-else>
            <FormC v-show="formType === 'C'">
                <ChainInput v-model="formType" :disabled="isConfirm"></ChainInput>
            </FormC>
            <div class="new_order_Form" v-show="formType !== 'C'">
                <div class="lists">
                    <ChainInput
                        @refresh="refresh"
                        v-model="formType"
                        :disabled="isConfirm"
                    ></ChainInput>
                    <div>
                        <tx-list
                            class="tx_list"
                            ref="txList"
                            @change="updateTxList"
                            :disabled="isConfirm"
                            :chainId="formType"
                            :pendingTxAmount="pendingTxAmount"
                        ></tx-list>
                        <template v-if="hasNFT">
                            <NftList
                                @change="updateNftList"
                                ref="nftList"
                                :disabled="isConfirm"
                            ></NftList>
                        </template>
                    </div>
                </div>
                <div>
                    <div class="to_address">
                        <h4>{{ $t('transfer.to') }}</h4>
                        <qr-input
                            v-model="addressIn"
                            :class="[
                                'qrIn',
                                'hover_border',
                                { pending: !!pendingSendMultisigTX && formType === 'P' },
                            ]"
                            style="padding: 0"
                            placeholder="xxx"
                            :disabled="isConfirm || (!!pendingSendMultisigTX && formType === 'P')"
                        ></qr-input>
                    </div>
                    <div>
                        <!-- <template v-if="isConfirm && formMemo.length > 0">
                            <h4>Memo (Optional)</h4>
                            <p class="confirm_val">{{ formMemo }}</p>
                        </template> -->
                        <h4>{{ $t('transfer.memo') }}</h4>
                        <textarea
                            :class="[
                                'memo',
                                { pending: !!pendingSendMultisigTX && formType === 'P' },
                            ]"
                            maxlength="256"
                            :placeholder="pendingSendMultisigTX ? '' : 'Memo'"
                            v-model="memo"
                            :disabled="isConfirm || (!!pendingSendMultisigTX && formType === 'P')"
                        ></textarea>
                    </div>
                    <div class="fees">
                        <p>
                            {{ $t('transfer.fee_tx') }}
                            <span>{{ txFeeBig.toLocaleString(9) }} {{ nativeAssetSymbol }}</span>
                        </p>
                    </div>
                    <div class="checkout">
                        <ul class="err_list" v-if="formErrors.length > 0">
                            <li v-for="err in formErrors" :key="err">
                                {{ err }}
                            </li>
                        </ul>
                        <template v-if="!isConfirm && !pendingSendMultisigTX">
                            <v-btn
                                depressed
                                class="button_primary"
                                :ripple="false"
                                @click="confirm"
                                :disabled="!canSend"
                                block
                            >
                                {{ $t('transfer.c_chain.confirm') }}
                            </v-btn>
                        </template>
                        <template v-else-if="pendingSendMultisigTX && formType === 'P'">
                            <div class="multi-sig__container">
                                <v-btn
                                    v-if="canExecuteMultisigTx"
                                    depressed
                                    class="button_secondary"
                                    @click="issueMultisigTx"
                                >
                                    {{ $t('transfer.multisig.execute_transaction') }}
                                </v-btn>
                                <v-btn
                                    v-else
                                    class="button_secondary"
                                    @click="signMultisigTx"
                                    depressed
                                    :disabled="disableSignButton"
                                >
                                    {{ $t('transfer.multisig.sign_transaction') }}
                                </v-btn>
                                <v-btn
                                    depressed
                                    class="button_primary"
                                    :ripple="false"
                                    @click="openAbortModal"
                                    block
                                >
                                    {{ $t('transfer.multisig.abort_transaction') }}
                                </v-btn>
                            </div>
                        </template>
                        <template v-else-if="isConfirm && !isSuccess && !pendingSendMultisigTX">
                            <template v-if="!isMultiSigErr">
                                <p class="err">{{ err }}</p>
                                <v-btn
                                    depressed
                                    class="button_primary"
                                    :loading="isAjax"
                                    :ripple="false"
                                    @click="submit"
                                    :disabled="!canSend"
                                    block
                                >
                                    {{ $t('transfer.send') }}
                                </v-btn>
                                <v-btn
                                    text
                                    block
                                    small
                                    style="margin-top: 20px !important; color: var(--primary-color)"
                                    @click="cancelConfirm"
                                >
                                    {{ $t('misc.cancel') }}
                                </v-btn>
                            </template>
                        </template>
                        <template v-else-if="isSuccess">
                            <p data-cy="transfer-tx-status" style="color: var(--success)">
                                <fa icon="check-circle"></fa>
                                {{ $t('transfer.success_title') }}
                            </p>
                            <label style="word-break: break-all">
                                <b>ID:</b>
                                {{ txId }}
                            </label>
                            <v-btn
                                depressed
                                style="margin-top: 14px"
                                class="button_primary"
                                :ripple="false"
                                @click="startAgain"
                                block
                                :disabled="!canSendAgain"
                            >
                                {{ $t('transfer.c_chain.reset') }}
                            </v-btn>
                        </template>
                    </div>
                </div>
            </div>
        </div>
        <ModalAbortSigning
            ref="modal_abort_signing"
            :title="$t('transfer.multisig.abort_transaction')"
            :modalText="$t('earn.rewards.abort_modal.message')"
            @cancelTx="cancelMultisigTx"
        />
    </div>
</template>
<script lang="ts">
import 'reflect-metadata'
import { Component, Vue, Watch } from 'vue-property-decorator'

import ModalAbortSigning from '@/components/wallet/earn/ModalAbortSigning.vue'
import TxList from '@/components/wallet/transfer/TxList.vue'
import Big from 'big.js'

import NftList from '@/components/wallet/transfer/NftList.vue'

//@ts-ignore
import FaucetLink from '@/components/misc/FaucetLink.vue'
import FormC from '@/components/wallet/transfer/FormC.vue'
import TxSummary from '@/components/wallet/transfer/TxSummary.vue'
import { ITransaction } from '@/components/wallet/transfer/types'
import { ChainIdType } from '@/constants'
import { bnToBig } from '@/helpers/helper'
import { WalletHelper } from '@/helpers/wallet_helper'
import { AvaNetwork } from '@/js/AvaNetwork'
import { WalletType } from '@/js/wallets/types'
import { IssueBatchTxInput, priceDict } from '@/store/types'
import { BN, Buffer } from '@c4tplatform/caminojs/dist'
import { UTXO } from '@c4tplatform/caminojs/dist/apis/avm'
import { QrInput } from '@c4tplatform/vue_components'
import * as bip39 from 'bip39'
import { ava, isValidAddress } from '@/AVA'

import { TxState } from '@/components/wallet/earn/ChainTransfer/types'
import ChainInput from '@/components/wallet/transfer/ChainInput.vue'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'
import { MultisigTx as SignavaultTx } from '@/store/modules/signavault/types'
import { UnsignedTx } from '@c4tplatform/caminojs/dist/apis/platformvm'
import { SignatureError } from '@c4tplatform/caminojs/dist/common'
import AvaAsset from '@/js/AvaAsset'

import { getTransactionSummary } from '@/helpers/history_helper'
import { parse } from '@/store/modules/history/history_utils'
import { ITransactionData } from '@/store/modules/history/types'

@Component({
    components: {
        FaucetLink,
        TxList,
        QrInput,
        NftList,
        TxSummary,
        FormC,
        ChainInput,
        ModalAbortSigning,
    },
})
export default class Transfer extends Vue {
    formType: ChainIdType = 'P'
    showAdvanced: boolean = false
    isAjax: boolean = false
    addressIn: string = ''
    memo: string = ''
    orders: ITransaction[] = []
    nftOrders: UTXO[] = []
    formErrors: string[] = []
    err = ''
    isMultiSigErr = false
    pendingTxAmount? = ''

    formAddress: string = ''
    formOrders: ITransaction[] = []
    formNftOrders: UTXO[] = []
    formMemo = ''

    isConfirm = false
    isSuccess = false
    isAborted = false
    txId = ''

    canSendAgain = false
    txState: TxState | null = null

    helpers = this.globalHelper()

    $refs!: {
        txList: TxList
        nftList: NftList
        modal_abort_signing: ModalAbortSigning
    }

    openAbortModal() {
        this.$refs.modal_abort_signing.open()
    }

    confirm() {
        let isValid = this.formCheck()
        if (!isValid) return

        this.formOrders = [...this.orders]
        this.formNftOrders = [...this.nftOrders]
        this.formAddress = this.addressIn
        this.formMemo = this.memo

        this.isConfirm = true
    }

    cancelConfirm() {
        this.err = ''
        this.formMemo = ''
        this.formOrders = []
        this.formNftOrders = []
        this.formAddress = ''
        this.isConfirm = false
    }

    updateTxList(data: ITransaction[]) {
        this.orders = data
    }

    updateNftList(val: UTXO[]) {
        this.nftOrders = val
    }

    formCheck() {
        this.formErrors = []
        let err = []

        let addr = this.addressIn

        let chain = addr.split('-')

        if (chain[0] !== this.formType[0]) {
            err.push(`Invalid address. You can only send to other ${this.formType} addresses.`)
        }

        if (!isValidAddress(addr)) {
            err.push('Invalid address.')
        }

        let memo = this.memo
        if (this.memo) {
            let buff = Buffer.from(memo)
            let size = buff.length
            if (size > 256) {
                err.push('You can have a maximum of 256 characters in your memo.')
            }

            // Make sure memo isnt mnemonic
            let isMnemonic = bip39.validateMnemonic(memo)
            if (isMnemonic) {
                err.push('You should not put a mnemonic phrase into the Memo field.')
            }
        }

        // Make sure to address matches the bech32 network hrp
        let hrp = ava.getHRP()
        if (!addr.includes(hrp)) {
            err.push('Not a valid address for this network.')
        }

        this.formErrors = err
        if (err.length === 0) {
            // this.send();
            return true
        } else {
            return false
        }
    }

    startAgain() {
        this.clearForm()

        this.txId = ''
        this.isSuccess = false
        this.isAborted = false
        this.cancelConfirm()

        this.orders = []
        this.nftOrders = []
        this.formOrders = []
        this.formNftOrders = []
    }

    clearForm() {
        if (!this.pendingSendMultisigTX || this.formType !== 'P') {
            this.addressIn = ''
            this.memo = ''
        }

        // Clear transactions list
        this.$refs.txList.reset()

        // Clear NFT list
        if (this.hasNFT) {
            this.$refs.nftList.clear()
        }
    }

    async onSuccess(tx: string) {
        this.isAjax = false
        this.isSuccess = true
        this.txId = tx
        if (tx) {
            this.helpers.dispatchNotification({
                message: this.$t('notifications.transfer_success_msg'),
                type: 'success',
            })
            // Update the user's balance
            this.$store.dispatch('Assets/updateUTXOs').then(() => {
                this.updateSendAgainLock()
            })
            setTimeout(() => this.$store.dispatch('History/updateTransactionHistory'), 3000)
        } else this.canSendAgain = true
    }

    updateSendAgainLock() {
        if (!this.wallet.isFetchUtxos) {
            this.$store.dispatch('History/updateTransactionHistory')
            this.canSendAgain = true
        } else {
            setTimeout(() => {
                this.updateSendAgainLock()
            }, 1000)
        }
    }

    onError(err: any) {
        this.err = err
        this.isAjax = false
        this.helpers.dispatchNotification({
            message: this.$t('notifications.transfer_error_msg'),
            type: 'error',
        })
    }
    @Watch('formType', { immediate: true })
    @Watch('activeWallet', { immediate: true })
    @Watch('activeNetwork')
    updateDetails() {
        if (this.isMultiSig && this.formType === 'P') this.updateMultisigTxDetails()
        else {
            this.memo = ''
            this.addressIn = ''
            this.pendingTxAmount = new BN(0).toLocaleString()
        }
    }

    get activeNetwork(): null | AvaNetwork {
        return this.$store?.state?.Network?.selectedNetwork
    }

    async refresh() {
        if (!this.isMultiSig) return
        await this.$store.dispatch('Signavault/updateTransaction')
        this.updateMultisigTxDetails()
        if (!this.pendingSendMultisigTX) {
            this.$refs.txList.reset()
            this.err = ''
            this.isConfirm = false
            this.memo = ''
            this.addressIn = ''
        }
    }
    get pendingSendMultisigTX(): SignavaultTx | undefined {
        return this.$store.getters['Signavault/transactions'].find(
            (item: SignavaultTx) =>
                item?.tx?.alias === this.wallet?.getStaticAddress('P') &&
                WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx) === 'BaseTx'
        )
    }

    get txOwners() {
        return this.pendingSendMultisigTX?.tx?.owners ?? []
    }

    get activeWallet(): MultisigWallet {
        return this.$store.state.activeWallet
    }

    async signMultisigTx() {
        const wallet = this.activeWallet
        if (!wallet || !(wallet instanceof MultisigWallet))
            return console.debug('MultiSigTx::sign: Invalid wallet')
        if (!this.pendingSendMultisigTX) return console.debug('MultiSigTx::sign: Invalid Tx')
        try {
            await wallet.addSignatures(this.pendingSendMultisigTX?.tx)
            this.helpers.dispatchNotification({
                message: 'Your signature saved successfully!',
                type: 'success',
            })
            this.$store.dispatch('Signavault/updateTransaction')
        } catch (e: any) {
            this.helpers.dispatchNotification({
                message: 'Your signature is not saved.',
                type: 'error',
            })
        }
    }
    get isMultiSig(): boolean {
        return this.wallet instanceof MultisigWallet
    }
    async issueMultisigTx() {
        const wallet = this.activeWallet
        if (!wallet || !(wallet instanceof MultisigWallet))
            return console.log('MultiSigTx::sign: Invalid wallet')
        if (!this.pendingSendMultisigTX) return console.log('MultiSigTx::sign: Invalid Tx')
        try {
            let txID = await wallet.issueExternal(this.pendingSendMultisigTX?.tx)
            this.isConfirm = true
            this.updateMultisigTxDetails()
            await this.onSuccess(txID)
        } catch (e: any) {
            this.helpers.dispatchNotification({
                message: this.$t('notifications.execute_multisig_transaction_error'),
                type: 'error',
            })
        }
    }

    async cancelMultisigTx() {
        try {
            const wallet = this.wallet as MultisigWallet
            if (this.pendingSendMultisigTX) {
                // cancel from the wallet
                await wallet.cancelExternal(this.pendingSendMultisigTX?.tx)
                this.helpers.dispatchNotification({
                    message: this.$t('transfer.multisig.transaction_aborted'),
                    type: 'success',
                })
                this.isAborted = true
                this.updateMultisigTxDetails()
            }
        } catch (err) {
            console.log(err)
            this.helpers.dispatchNotification({
                message: this.$t('transfer.multisig.cancel_transaction_failed'),
                type: 'error',
            })
        }
    }

    get disableSignButton(): boolean {
        let isSigned = false
        this.txOwners.forEach((owner) => {
            if (
                this.activeWallet.wallets.find((w) => w?.getAllAddressesP()?.[0] === owner.address)
            ) {
                if (owner.signature) isSigned = true
            }
        })
        return isSigned
    }
    get canExecuteMultisigTx(): boolean {
        let signers = 0
        let threshold = this.pendingSendMultisigTX?.tx?.threshold
        this.txOwners.forEach((owner) => {
            if (owner.signature) signers++
        })
        if (threshold) return signers >= threshold
        return false
    }
    async updateMultisigTxDetails() {
        this.isMultiSigErr = false
        if (this.formType !== 'P') return
        await this.$store.dispatch('Assets/updateUTXOs')
        await this.$store.dispatch('Signavault/updateTransaction')
        if (this.pendingSendMultisigTX) {
            let unsignedTx = new UnsignedTx()
            unsignedTx.fromBuffer(Buffer.from(this.pendingSendMultisigTX.tx?.unsignedTx, 'hex'))
            const utx = unsignedTx.getTransaction()
            this.memo = utx.getMemo().toString()
            let t: ITransactionData = parse([this.pendingSendMultisigTX])[0]
            let { tokens } = getTransactionSummary(t, this.$store.state.activeWallet as WalletType)
            for (var assetId in tokens) {
                if (tokens[assetId].addresses[0])
                    this.addressIn = `P-${tokens[assetId].addresses[0]}`
                else this.addressIn = this.wallet.getStaticAddress('P')
                this.pendingTxAmount = bnToBig(
                    tokens[assetId].amount.add(new BN(t.txFee)).abs(),
                    9
                ).toLocaleString()
            }
        } else {
            this.pendingTxAmount = ''
            if (this.isAborted) this.startAgain()
        }
    }

    submit() {
        this.isAjax = true
        this.err = ''

        let sumArray: (ITransaction | UTXO)[] = [...this.formOrders, ...this.formNftOrders]

        let txList: IssueBatchTxInput = {
            chainId: this.formType,
            toAddress: this.formAddress,
            memo: Buffer.from(this.formMemo),
            orders: sumArray,
        }

        this.$store
            .dispatch('issueBatchTx', txList)
            .then((res) => {
                this.canSendAgain = false
                this.waitTxConfirm(res)
                this.txId = res
            })
            .catch((err) => {
                if (err instanceof SignatureError) {
                    let { dispatchNotification } = this.globalHelper()
                    this.$store.dispatch('Assets/updateUTXOs')
                    this.$store.dispatch('Signavault/updateTransaction').then(() => {
                        this.$store.dispatch('updateBalances')
                        dispatchNotification({
                            message: this.$t('notifications.transfer_success_msg'),
                            type: 'success',
                        })
                        this.txState = TxState.success
                        this.isAjax = false
                        this.isMultiSigErr = true
                    })
                } else this.onError(err)
            })
    }

    async waitTxConfirm(txId: string) {
        let status =
            this.formType === 'P'
                ? await ava.PChain().getTxStatus(txId)
                : await ava.XChain().getTxStatus(txId)

        if (status === 'Unknown' || status === 'Processing') {
            // if not confirmed ask again
            setTimeout(() => {
                this.waitTxConfirm(txId)
            }, 500)
            return false
        } else if (status === 'Dropped') {
            // If dropped stop the process
            this.txState = TxState.failed
            return false
        } else {
            // If success display success page
            this.txState = TxState.success
            this.onSuccess(txId)
        }
    }

    get networkStatus(): string {
        let stat = this.$store.state.Network.status
        return stat
    }

    get hasNFT(): boolean {
        return this.formType === 'X' && this.$store.state.Assets.nftUTXOs.length > 0
    }

    get faucetLink() {
        let link = process.env.VUE_APP_FAUCET_LINK
        if (link) return link
        return null
    }
    get canSend() {
        if (!this.addressIn) return false

        if (
            this.orders.length > 0 &&
            this.totalTxSize.eq(new BN(0)) &&
            this.nftOrders.length === 0
        ) {
            return false
        }

        if (this.orders.length === 0 && this.nftOrders.length === 0) return false

        return true
    }
    get totalTxSize() {
        let res = new BN(0)
        for (var i = 0; i < this.orders.length; i++) {
            let order = this.orders[i]
            if (order.amount) {
                res = res.add(this.orders[i].amount)
            }
        }

        return res
    }
    get avaxTxSize() {
        let res = new BN(0)
        for (var i = 0; i < this.orders.length; i++) {
            let order = this.orders[i]
            if (!order.asset) continue
            if (order.amount && order.asset.id === this.avaxAsset.id) {
                res = res.add(this.orders[i].amount)
            }
        }

        return res
    }
    get avaxAsset(): AvaAsset {
        return this.$store.getters['Assets/AssetAVA']
    }

    get wallet(): WalletType {
        return this.$store.state.activeWallet
    }

    get txFee(): BN {
        return this.formType === 'P' ? ava.PChain().getTxFee() : ava.XChain().getTxFee()
    }

    get txFeeBig(): Big {
        return bnToBig(this.txFee, 9)
    }

    get totalUSD(): Big {
        let totalAsset = this.avaxTxSize.add(this.txFee)
        let bigAmt = bnToBig(totalAsset, 9)
        let usdPrice = this.priceDict.usd
        let usdBig = bigAmt.times(usdPrice)
        return usdBig
    }

    get addresses() {
        return this.$store.state.addresses
    }

    get priceDict(): priceDict {
        return this.$store.state.prices
    }

    get nftUTXOs(): UTXO[] {
        return this.$store.state.Assets.nftUTXOs
    }

    get nativeAssetSymbol(): string {
        return this.$store.getters['Assets/AssetAVA']?.symbol ?? ''
    }

    deactivated() {
        this.startAgain()
    }

    activated() {
        this.clearForm()

        if (this.$route.query.chain) {
            let chain = this.$route.query.chain as ChainIdType
            if (['P', 'X', 'C'].includes(chain)) this.formType = chain
        }

        if (this.$route.query.nft) {
            let utxoId = this.$route.query.nft as string
            let target = this.nftUTXOs.find((el) => {
                return el.getUTXOID() === utxoId
            })

            if (target) {
                this.$refs.nftList.addNft(target)
            }
        }
    }
}
</script>

<style lang="scss">
@use '../../../styles/abstracts/mixins';
.multi-sig__container {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.advanced_panel {
    .v-expansion-panel-header {
        padding: 0;
        @include mixins.typography-caption;
        color: #2c3e50;
        min-height: auto !important;
        margin-bottom: 10px;
    }
    .v-expansion-panel-content__wrap {
        padding: 0 !important;
    }

    .v-icon {
        @include mixins.typography-caption;
    }
}
</style>
<style scoped lang="scss">
@use '../../../styles/abstracts/mixins';

$padLeft: 24px;
$padTop: 8px;

.pending {
    color: var(--primary-color-light) !important;
}

.disconnected {
    padding: 30px;
    text-align: center;
    background-color: var(--bg-light);
}

.explain {
    @include mixins.typography-caption;
    color: var(--primary-color-light);
}
h1 {
    font-weight: normal;
}
h4 {
    display: block;
    text-align: left;
    @include mixins.typography-caption;
    font-weight: bold;
    margin: 12px 0;
}

.send_to {
    display: flex;
    margin-bottom: 10px;
}

.addressIn >>> input {
    color: var(--bg) !important;
    padding: 5px 6px !important;
    text-align: center;
    letter-spacing: 2px;
    @include mixins.typography-caption;
}

.addressIn >>> input::-webkit-input-placeholder {
    color: var(--primary-color-light) !important;
}

.addressIn .v-input__slot:before {
    display: none;
}

.readerBut {
    margin-top: 4px;
    display: flex;
    background-color: #404040;
}
.readerBut button {
    opacity: 0.6;
    outline: none;
    padding: 6px 12px;
    margin: 0px auto;
}
.readerBut:hover button {
    opacity: 1;
}

.memo {
    @include mixins.typography-caption;
    background-color: var(--bg-light);
    resize: none;
    width: 100%;
    height: 80px;
    border-radius: var(--border-radius-sm);
    padding: 4px 12px;
}

.radio_buttons {
    margin-top: 15px;
}

.tx_info {
    text-align: left;
    @include mixins.typography-caption;
}

.new_order_Form {
    display: grid;
    grid-template-columns: 1fr 1fr 300px;
    column-gap: 45px;
}

.new_order_Form > div {
    margin-bottom: 15px;
}

.lists {
    border-right: 1px solid var(--bg-light);
    grid-column: 1/3;
}

.tx_list {
    margin-bottom: 14px;
}

.fees {
    margin: 14px 0;
    border-top: 1px solid var(--bg-light);
    padding-top: 14px;
}

.fees p {
    text-align: left;
    @include mixins.typography-caption;
    color: var(--primary-color-light);
}

.fees span {
    float: right;
}

label {
    color: var(--primary-color-light);
    @include mixins.typography-caption;
    font-weight: bold;
    margin: 2px 0 !important;
}

.faucet {
    margin-top: 20px;
}

.advanced {
    padding: 20px 0px !important;
    margin-bottom: 20px;
}

.advanced .advancedBody {
    transition-duration: 0.2s;
}

.err_list {
    @include mixins.typography-caption;
    color: var(--error);
    margin: 6px 0;
}

.checkout {
    margin-top: 14px;
}

.confirm_val {
    background-color: var(--bg-light);
    word-break: break-all;
    padding: 8px 16px;
}

@include mixins.medium-device {
    .new_order_Form {
        grid-template-columns: 1fr 1fr 220px;
        column-gap: 25px;
    }
}

@include mixins.mobile-device {
    .transfer_card {
        display: block;
        grid-template-columns: none;
    }

    .but_primary {
        width: 100%;
    }

    .new_order_Form {
        display: block;
        grid-template-columns: none;
    }

    .tx_list {
        padding: 0;
        border: none;
    }

    .lists {
        border: none;
    }
}
</style>
