<template>
    <div class="earn_page">
        <div class="header">
            <h1 :class="depositAndBond ? '' : 'wrong_network'" v-if="validatorIsSuspended">
                {{ $t('validator.suspended.title') }}
            </h1>
            <div v-else-if="(nodeInfo === undefined || nodeInfo === null) && !validatorIsSuspended">
                <h1 v-if="!!multisigPendingNodeTx && !isNodeRegistered">
                    {{ $t('earn.subtitle5') }}
                </h1>
                <h1 v-else>{{ $t('earn.subtitle1') }}</h1>
            </div>
            <h1 v-else :class="depositAndBond ? '' : 'wrong_network'">
                {{ $t('validator.info.validator_running') }}
            </h1>
            <div class="refresh">
                <Spinner v-if="loading" class="spinner"></Spinner>
                <button v-else @click="refresh">
                    <v-icon>mdi-refresh</v-icon>
                </button>
            </div>
        </div>
        <transition name="fade" mode="out-in">
            <div>
                <div class="tab-nav">
                    <div>
                        <button @click="tab = 'opt-validator'" :active="tab === `opt-validator`">
                            {{ $t('validator.rewards.tab.node') }}
                        </button>
                        <button @click="tab = 'opt-rewards'" :active="tab === `opt-rewards`">
                            {{ $t('validator.rewards.tab.rewards') }}
                        </button>
                    </div>
                </div>

                <div v-if="tab == 'opt-validator'">
                    <p v-if="!depositAndBond" class="wrong_network">{{ $t('earn.warning_3') }}</p>
                    <div v-else-if="!isNodeRegistered" class="no_balance">
                        <pending-multisig
                            v-if="!!multisigPendingNodeTx"
                            :multisigTx="multisigPendingNodeTx"
                            @issued="onNodeRegistered"
                            @refresh="handlePendingMultisigRefresh"
                        ></pending-multisig>
                        <register-node
                            v-else
                            :isKycVerified="isKycVerified"
                            :isConsortiumMember="isConsortiumMember"
                            :minPlatformUnlocked="minPlatformUnlocked"
                            :hasEnoughLockablePlatformBalance="hasEnoughLockablePlatformBalance"
                            :isNodeRegistered="isNodeRegistered"
                            @registered="onNodeRegistered"
                            :loadingRefreshRegisterNode="loadingRefreshRegisterNode"
                            @refresh="refresh()"
                        ></register-node>
                    </div>
                    <template v-else-if="!!pendingValidator">
                        <div class="pending-validator-div">
                            <validator-pending
                                :startDate="pendingValidator.startTime"
                                @refresh="refresh"
                            ></validator-pending>
                        </div>
                    </template>
                    <template
                        v-else-if="
                            (nodeInfo === undefined || nodeInfo === null) &&
                            !validatorIsSuspended &&
                            !pendingValidator
                        "
                    >
                        <keep-alive>
                            <pending-multisig
                                v-if="!!multisigPendingNodeTx"
                                :nodeId="nodeId"
                                :multisigTx="multisigPendingNodeTx"
                                @issued="onAddValidatorIssued"
                                @refresh="handlePendingMultisigRefresh"
                            ></pending-multisig>
                            <add-validator
                                v-else
                                :nodeId="nodeId"
                                @validatorReady="verifyValidatorIsReady"
                                @initiated="onAddValidatorInitiated"
                                @refresh="refresh()"
                            ></add-validator>
                        </keep-alive>
                    </template>
                    <div v-else-if="validatorIsSuspended">
                        <validator-suspended :nodeId="nodeId"></validator-suspended>
                    </div>
                    <div v-else>
                        <validator-info
                            :nodeId="nodeId"
                            :nodeInfo="nodeInfo"
                            :startTime="startTime"
                            :endTime="endTime"
                            :upTime="upTime"
                            :reaminingValidation="reaminingValidation"
                            :bondedAmount="bondedAmount"
                            :txID="txID"
                            :nodeVersion="nodeVersion"
                            :initialized="initialized"
                            @getValidatorInfo="getInformationValidator"
                        ></validator-info>
                    </div>
                </div>
                <div v-if="tab == 'opt-rewards'">
                    <div v-if="nodeInfo">
                        <ClaimRewards
                            :nodeId="nodeId"
                            :nodeInfo="nodeInfo"
                            :rewardAmount="rewardAmount"
                            :pChainddress="pChainddress"
                            :isMultisignTx="isMultisignTx"
                            :pendingTx="pendingTx"
                            :loading="loading"
                            @refresh="refresh"
                            @getClaimableReward="getClaimableReward"
                            @getPendingTransaction="getPendingTransaction"
                            @getPChainAddress="getPChainAddress"
                        />
                    </div>
                    <div v-else>
                        <div class="rewards-not-available">
                            <RewardsNotAvailable />
                        </div>
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>
<script lang="ts">
import { ValidatorRaw } from '@/components/misc/ValidatorList/types'
import RewardsNotAvailable from '@/components/wallet/earn/RewardsNotAvailable.vue'
import AddValidator from '@/components/wallet/earn/Validate/AddValidator.vue'
import ClaimRewards from '@/components/wallet/earn/Validate/ClaimRewards.vue'
import PendingMultisig from '@/components/wallet/earn/Validate/PendingMultisig.vue'
import RegisterNode from '@/components/wallet/earn/Validate/RegisterNode.vue'
import ValidatorInfo from '@/components/wallet/earn/Validate/ValidatorInfo.vue'
import ValidatorPending from '@/components/wallet/earn/Validate/ValidatorPending.vue'
import ValidatorSuspended from '@/components/wallet/earn/Validate/ValidatorSuspended.vue'
import { bnToBig } from '@/helpers/helper'
import { WalletHelper } from '@/helpers/wallet_helper'
import MnemonicWallet from '@/js/wallets/MnemonicWallet'
import { WalletCore } from '@/js/wallets/WalletCore'
import { MultisigTx as SignavaultTx } from '@/store/modules/signavault/types'
import { BN, Buffer } from '@c4tplatform/caminojs/dist'
import { AddressState, ClaimTx, UnsignedTx } from '@c4tplatform/caminojs/dist/apis/platformvm'
import Big from 'big.js'
import axios from 'axios'
import 'reflect-metadata'
import { Component, Vue, Watch } from 'vue-property-decorator'
import { AvaNetwork } from '@/js/AvaNetwork'
import Spinner from '@/components/misc/Spinner.vue'
import moment from 'moment'
import { ava, bintools } from '@/AVA'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'
import { WalletType } from '@/js/wallets/types'
import { ClaimType } from '@c4tplatform/caminojs/dist/apis/platformvm'

@Component({
    name: 'validator',
    components: {
        RegisterNode,
        AddValidator,
        ValidatorInfo,
        ValidatorSuspended,
        ClaimRewards,
        PendingMultisig,
        ValidatorPending,
        RewardsNotAvailable,
        Spinner,
    },
})
export default class Validator extends Vue {
    isKycVerified = false
    isConsortiumMember = false
    isNodeRegistered = false
    isSuspended = false
    registeredNodeID = ''
    intervalID: any = null
    nodeId = ''
    nodeInfo: ValidatorRaw | null = null
    validatorIsSuspended: boolean = false
    loadingRefreshRegisterNode: boolean = false
    tab: string = 'opt-validator'
    pendingValidator: ValidatorRaw | null = null
    loading: boolean = false
    private remainingInterval: ReturnType<typeof setInterval> | null = null

    nodeVersion: string = ''
    initialized: boolean = false

    startTime: string = ''
    endTime: string = ''
    upTime: number = 0
    reaminingValidation: string = ''
    bondedAmount: BN = new BN(0)
    txID: string = ''

    rewardAmount: BN = new BN(0)
    pChainddress: string = ''
    isMultisignTx: boolean = false
    pendingTx: any = undefined

    // @ts-ignore
    helpers = this.globalHelper()

    get multisigPendingNodeTx(): SignavaultTx | undefined {
        return this.$store.getters['Signavault/transactions'].find(
            (item: any) =>
                item?.tx?.alias === this.addresses[0] &&
                ['CaminoAddValidatorTx', 'RegisterNodeTx'].includes(
                    WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx)
                )
        )
    }

    @Watch('$store.state.activeWallet')
    async onActiveWalletChange() {
        this.nodeInfo = null
        this.nodeId = ''
        this.pendingValidator = null
        this.isNodeRegistered = false
        this.isSuspended = false
        this.registeredNodeID = ''
        this.isKycVerified = false
        this.isConsortiumMember = false
        this.validatorIsSuspended = false
        this.loadingRefreshRegisterNode = false
        this.tab = 'opt-validator'
        this.loading = false
        this.nodeVersion = ''
        this.initialized = false
        this.startTime = ''
        this.endTime = ''
        this.upTime = 0
        this.reaminingValidation = ''
        this.bondedAmount = new BN(0)
        this.txID = ''

        this.evaluateCanRegisterNode()
        this.updateValidators()
    }

    verifyValidatorIsReady(val: ValidatorRaw) {
        this.nodeInfo = val
    }

    startRemainingTimer() {
        if (this.remainingInterval !== null) return

        this.remainingInterval = setInterval(() => {
            if (!this.nodeInfo) return

            const now = moment()
            const end = moment.unix(Number(this.nodeInfo.endTime))

            const diff = moment.duration(end.diff(now))

            if (diff.asSeconds() <= 0) {
                this.refresh()
                this.stopRemainingTimer()
            } else {
                this.reaminingValidation = this.humanizeDuration(diff)
            }
        }, 1000)
    }

    stopRemainingTimer() {
        if (this.remainingInterval !== null) {
            clearInterval(this.remainingInterval)
            this.remainingInterval = null
        }
    }

    async updateValidators() {
        const updatingValidators = this.$store.dispatch('Platform/updateValidators')
        return updatingValidators
    }

    activated() {
        this.evaluateCanRegisterNode()
        this.updateValidators()
        this.intervalID = setInterval(() => {
            this.updateValidators()
        }, 15000)
    }

    async handlePendingMultisigRefresh() {
        await this.$store.dispatch('Signavault/updateTransaction')
        this.evaluateCanRegisterNode()
    }

    deactivated() {
        clearInterval(this.intervalID)
        this.stopRemainingTimer()
    }

    hrp() {
        return ava.getHRP()
    }

    @Watch('addresses')
    async evaluateCanRegisterNode() {
        const BN_ONE = new BN(1)
        const result = await WalletHelper.getAddressState(this.addresses[0])
        this.isKycVerified =
            !result.and(BN_ONE.shln(AddressState.KYC_VERIFIED)).isZero() ||
            !result.and(BN_ONE.shln(AddressState.KYB_VERIFIED)).isZero()
        this.isConsortiumMember = !result.and(BN_ONE.shln(AddressState.CONSORTIUM)).isZero()
        this.validatorIsSuspended = !result.and(BN_ONE.shln(AddressState.NODE_DEFERRED)).isZero()

        try {
            this.nodeId = await WalletHelper.getRegisteredNode(this.addresses[0])
            this.isNodeRegistered = !!this.nodeId

            if (this.nodeId) {
                // node is registered, check if is pending
                const val = await WalletHelper.findPendingValidator(this.nodeId)
                this.pendingValidator = val
            }
        } catch (e) {
            this.isNodeRegistered = false
            this.pendingValidator = null
        }
    }

    async onNodeRegistered(status: 'issued' | 'pending') {
        if (status === 'issued') {
            try {
                this.nodeId = await WalletHelper.getRegisteredNode(this.addresses[0])
                this.isNodeRegistered = !!this.nodeId
            } catch (e) {
                this.isNodeRegistered = false
            }
        } else {
            await this.$store.dispatch('Signavault/updateTransaction')
            this.evaluateCanRegisterNode()
        }
    }

    async onAddValidatorInitiated() {
        //  Multisig flow, tx is saved to signavault
        await this.$store.dispatch('Signavault/updateTransaction')
        this.evaluateCanRegisterNode()
    }

    async onAddValidatorIssued() {
        //  Multisig flow, tx handled by signavault
        await this.$store.dispatch('Signavault/updateTransaction')
        this.evaluateCanRegisterNode()
    }

    get hasEnoughLockablePlatformBalance(): boolean {
        return this.platformStakeable.gte(this.minPlatformUnlocked)
    }

    get platformStakeable(): BN {
        return this.platformUnlocked.add(this.platformLockedStakeable)
    }

    get staticAddress() {
        return (this.$store.state.activeWallet as WalletCore).getStaticAddress('P')
    }

    @Watch('activeNetwork')
    get addresses() {
        let wallet: MnemonicWallet = this.$store.state.activeWallet
        return wallet.getAllAddressesP()
    }

    get platformUnlocked(): BN {
        if (this.depositAndBond) return this.$store.getters['Assets/walletPlatformBalanceUnlocked']
        else return this.$store.getters['Assets/walletPlatformBalance']
    }

    get minPlatformUnlocked(): BN {
        return this.$store.state.Platform.minStake
    }

    get depositAndBond(): boolean {
        return this.$store.getters['Network/depositAndBond']
    }

    get platformLockedStakeable(): BN {
        if (this.depositAndBond) return this.$store.getters['Assets/walletPlatformBalanceDeposited']
        return this.$store.getters['Assets/walletPlatformBalanceLockedStakeable']
    }

    get platformTotalLocked(): BN {
        return this.$store.getters['Assets/walletPlatformBalanceTotalLocked']
    }

    get totBal(): BN {
        if (this.depositAndBond) {
            return this.platformUnlocked.add(this.platformTotalLocked)
        }
        return this.platformUnlocked.add(this.platformLockedStakeable)
    }

    get pNoBalance() {
        if (this.depositAndBond) return this.platformUnlocked.add(this.platformTotalLocked).isZero()
        return this.platformUnlocked.add(this.platformLockedStakeable).isZero()
    }

    get canValidate(): boolean {
        let bn = this.$store.state.Platform.minStake
        if (this.totBal.lt(bn)) {
            return false
        }
        return true
    }

    get minStakeAmt(): Big {
        let bn = this.$store.state.Platform.minStake
        return bnToBig(bn, 9)
    }

    get minDelegationAmt(): Big {
        let bn = this.$store.state.Platform.minStakeDelegation
        return bnToBig(bn, 9)
    }

    async refresh() {
        await this.updateValidators()
        if (this.tab == 'opt-rewards') {
            this.loading = true
            await this.$store.dispatch('Signavault/updateTransaction')
            await this.getClaimableReward()
            await this.getPChainAddress()
            await this.getPendingTransaction()
            this.loading = false
        } else {
            if (this.multisigPendingNodeTx) {
                await this.$store.dispatch('Signavault/updateTransaction')
                await this.evaluateCanRegisterNode()
            }
            this.loadingRefreshRegisterNode = true
            this.loading = true
            this.$store.dispatch('updateBalances')
            if (this.isMultisignTx) await this.getPendingTransaction()
            await this.evaluateCanRegisterNode()
            await this.$store.dispatch('Signavault/updateTransaction')
            if (this.hasValidator) {
                await this.getInformationValidator()
                this.startRemainingTimer()
            } else {
                this.nodeInfo = null
            }
            this.loading = false
            this.loadingRefreshRegisterNode = false
        }
    }

    async getPendingTransaction() {
        this.pendingTx = undefined

        if (!this.isMultisignTx) return

        const txClaim = this.$store.getters['Signavault/transactions'].find(
            (item: SignavaultTx) =>
                item?.tx?.alias === this.pChainddress &&
                WalletHelper.getUnsignedTxType(item?.tx?.unsignedTx) === 'ClaimTx'
        )

        if (!txClaim) return

        const unsignedTx = new UnsignedTx()
        unsignedTx.fromBuffer(Buffer.from(txClaim.tx?.unsignedTx, 'hex'))
        const utx = unsignedTx.getTransaction() as ClaimTx

        for (const claimAmount of utx.getClaimAmounts()) {
            const claimType = bintools.fromBufferToBN(claimAmount.getType()).toString()
            if (claimType === ClaimType.VALIDATOR_REWARD) {
                this.pendingTx = txClaim
                break
            }
        }
    }

    async getClaimableReward() {
        if (this.nodeInfo == null) return

        let responseClaimable = await WalletHelper.getClaimables(
            this.nodeInfo.rewardOwner.addresses[0].toString(),
            this.nodeInfo.txID
        )

        if (responseClaimable != null && responseClaimable != undefined) {
            this.rewardAmount = responseClaimable.validatorRewards
        } else {
            this.rewardAmount = new BN(0)
        }
    }

    async getPChainAddress() {
        try {
            if (this.$store.state.activeWallet instanceof MultisigWallet) {
                let activeWallet: MultisigWallet = this.$store.state.activeWallet
                let address = activeWallet.getCurrentAddressPlatform()
                this.pChainddress = address
                this.isMultisignTx = true
            } else {
                let activeWallet: WalletType = this.$store.state.activeWallet
                let address = await activeWallet.getAllAddressesP()
                this.pChainddress = address[0]
                this.isMultisignTx = false
            }
        } catch (e) {
            console.error(e)
        }
    }

    @Watch('$store.state.Platform.validators', { deep: true })
    async onValidatorsUpdated() {
        if (!this.nodeId) return

        // re-check pending / active state
        const pending = await WalletHelper.findPendingValidator(this.nodeId)
        this.pendingValidator = pending

        if (!pending) {
            // validator might now be active or expired
            await this.evaluateCanRegisterNode()

            if (this.hasValidator) {
                await this.getInformationValidator()
            } else {
                this.nodeInfo = null
            }
        }
    }

    get hasValidator(): boolean {
        return this.$store.getters['Platform/isValidator'](this.nodeId)
    }

    get activeNetwork(): null | AvaNetwork {
        return this.$store?.state?.Network?.selectedNetwork
    }

    async fetchNodeVersion() {
        if (this.activeNetwork && this.activeNetwork.url) {
            await axios
                .post(this.activeNetwork.url + '/ext/info', {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'info.getNodeVersion',
                })
                .then((res) => {
                    const data = res.data
                    if (data && data.result && data.result.gitVersion) {
                        this.nodeVersion = data.result.gitVersion.slice(1) // remove v
                    }
                })
                .finally(() => {
                    this.initialized = true
                })
        }
    }

    checkNodeVersionFlag(targetVersion: string): boolean {
        if (!this.initialized) {
            throw new Error('Provider not initialized yet')
        }

        if (!this.nodeVersion) {
            throw new Error('Node version not exists, function uncallable')
        }

        const versionRegex = /^\d+\.\d+\.\d+(-rc\d+)?$/
        if (!versionRegex.test(targetVersion)) {
            throw new Error(
                `Invalid version format: ${targetVersion}. Correct version is of type major.minor.path e.g 1.2.3-rc2`
            )
        }

        const [coreTargetVersion, targetVariant] = targetVersion.split('-')
        const [coreNodeVersion, nodeVariant] = this.nodeVersion.split('-')

        const [targetMajor, targetMinor, targetPatch] = coreTargetVersion.split('.').map(Number)
        const [nodeMajor, nodeMinor, nodePatch] = coreNodeVersion.split('.').map(Number)

        if (targetMajor !== nodeMajor) {
            return targetMajor < nodeMajor
        }

        if (targetMinor !== nodeMinor) {
            return targetMinor < nodeMinor
        }

        if (targetPatch !== nodePatch) {
            return targetPatch < nodePatch
        }

        if (nodeVariant) {
            return targetVariant <= nodeVariant
        }

        return true
    }

    formatUptime(uptime: string): number {
        const versionFlag = this.checkNodeVersionFlag('0.4.10-rc3')
        const value = versionFlag
            ? Math.round(parseFloat(uptime))
            : Math.round(parseFloat(uptime) * 100)

        return value
    }

    humanizeDuration(duration: moment.Duration) {
        const years = duration.years()
        const months = duration.months()
        const days = duration.days()
        const hours = duration.hours()
        const minutes = duration.minutes()
        const seconds = duration.seconds()

        let result = ''
        if (years > 0) result += years + (years === 1 ? ' Year ' : ' Years ')
        if (months > 0) result += months + (months === 1 ? ' Month ' : ' Months ')
        if (days > 0) result += days + (days === 1 ? ' Day ' : ' Days ')
        if (hours > 0) result += hours + ' h '
        if (minutes > 0) result += minutes + ' m '
        if (seconds > 0) result += seconds + ' s'

        return result.trim()
    }

    async getInformationValidator() {
        try {
            await this.fetchNodeVersion()
            this.loading = true
            let today = moment()

            if (this.nodeInfo === null) throw new Error('Node info is null')

            this.startTime = moment(new Date(parseInt(this.nodeInfo.startTime) * 1000)).format(
                'MMM Do YYYY, h:mm:ss A'
            )
            this.endTime = moment(new Date(parseInt(this.nodeInfo.endTime) * 1000)).format(
                'MMM Do YYYY, h:mm:ss A'
            )
            this.upTime = this.formatUptime(this.nodeInfo.uptime)

            var reaminingValidationDuration = moment.duration(
                moment(new Date(parseInt(this.nodeInfo.endTime) * 1000)).diff(today)
            )

            this.reaminingValidation = this.humanizeDuration(reaminingValidationDuration)
            this.bondedAmount = new BN(parseFloat(this.nodeInfo.stakeAmount) / 1000000000)
            this.txID = this.nodeInfo.txID
        } catch (e) {
            console.error(e)
        } finally {
            this.loading = false
        }
    }
}
</script>
<style scoped lang="scss">
@use '../../styles/abstracts/mixins';

/* body {
    height: auto;
    overflow: auto !important;
} */

.refresh {
    max-width: 30px;
    max-width: 30px;
    margin-left: auto;
    position: absolute;
    top: 11px;
    right: 0;
    .v-icon {
        color: var(--primary-color);
    }

    button {
        padding: 0 !important;
        margin: 0 !important;
        outline: none !important;
    }
    img {
        object-fit: contain;
        width: 100%;
    }

    .spinner {
        color: var(--primary-color) !important;
    }
}

.earn_page {
    display: grid;
    grid-template-rows: max-content 1fr;
    min-height: 300px;
}

.header {
    margin-bottom: 1rem;
    position: relative;

    h1 {
        font-weight: normal;
        margin-right: 30px;
    }

    display: flex;
    /*justify-content: space-between;*/
    /*align-items: center;*/
    align-items: center;

    .subtitle {
        margin-left: 0.5em;
        color: var(--primary-color-light);
    }

    span {
        margin-left: 1em;

        &:hover {
            color: var(--primary-color);
            cursor: pointer;
        }
    }
}

.wrong_network {
    color: var(--primary-color-light);
}

.options {
    margin: 30px 0;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-gap: 14px;
    //display: flex;
    //justify-content: space-evenly;
    //padding: 60px;

    > div {
        width: 100%;
        justify-self: center;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: flex-start;
        //max-width: 260px;
        padding: 30px;
        border-radius: var(--border-radius-sm);
        background-color: var(--bg-light);
    }

    h4 {
        font-size: 32px !important;
        font-weight: lighter;
        color: var(--primary-color-light);
    }

    p {
        /*color: var(--primary-color-light);*/
        margin: 14px 0 !important;
    }

    .no_balance {
        color: var(--secondary-color);
    }

    .v-btn {
        margin-top: 14px;
    }
}

span {
    color: var(--primary-color-light);
    opacity: 0.5;
    float: right;
    font-weight: lighter;
}

.cancel {
    @include mixins.typography-caption;
    color: var(--secondary-color);
    justify-self: flex-end;
}

.comp {
    margin-top: 14px;
}

@include mixins.medium-device {
    .options {
        grid-template-columns: 1fr 1fr;
    }

    .tab-nav {
        button {
            font-size: 13px;

            &[active] {
                border-bottom-width: 2px;
            }
        }
    }
}

@include mixins.mobile-device {
    .options {
        grid-template-columns: none;
        grid-row-gap: 15px;
    }

    .tab-nav {
        display: block;

        > div {
            overflow: hidden;
            display: flex;
        }
        button {
            flex-grow: 1;
            border-radius: 0px;
            margin: 0;
            font-size: 12px;
        }
    }
}

.tab-nav {
    display: flex;
    align-items: center;
    border-bottom: 2px solid transparent;
    flex-wrap: nowrap;
    white-space: nowrap;

    h1 {
        font-weight: normal;
        margin-right: 30px;
    }

    button {
        padding: 8px 24px;
        font-size: 14px;
        font-weight: bold;
        margin: 0px 5px;
        text-transform: uppercase;
        outline: none !important;
        color: var(--primary-color-light);

        &[active] {
            color: var(--secondary-color);
            border-bottom: 2px solid var(--secondary-color);
        }
    }
}

.pending-validator-div {
    position: relative;
    top: 35px;
}

.rewards-not-available {
    position: relative;
    top: 15px;
}
</style>
<style lang="scss">
.disabled_input {
    display: inline-block;
    border-radius: var(--border-radius-sm);
    color: gray;
    background-color: var(--bg-light);
    padding: 10px 14px;
    width: 100%;
    overflow-wrap: anywhere;
}

.disabled_input:focus-visible {
    outline: 0;
}
</style>
