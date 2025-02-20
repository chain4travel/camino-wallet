<template>
    <div class="activity_page">
        <ExportCsvModal ref="csv_modal"></ExportCsvModal>
        <ExportAvaxCsvModal ref="avax_csv_modal"></ExportAvaxCsvModal>
        <div class="explorer_warning" v-if="!hasExplorer">
            <div class="warning_body">
                <h1>{{ $t('activity.no_explorer.title') }}</h1>
                <p>{{ $t('activity.no_explorer.desc') }}</p>
            </div>
        </div>
        <div class="settings">
            <div class="filter_col">
                <div class="filter_cont">
                    <label>Export CSV File (BETA)</label>
                    <div class="csv_buttons">
                        <CamBtn variant="primary" :disabled="!showList" @click="openCsvModal">
                            Export Rewards
                        </CamBtn>
                        <CamBtn variant="primary" :disabled="!showList" @click="openAvaxCsvModal">
                            Export Native asset Transfers
                        </CamBtn>
                    </div>
                </div>
                <div class="filter_cont">
                    <label>{{ $t('activity.label1') }}</label>
                    <RadioButtons :labels="modes" :keys="modeKey" v-model="mode"></RadioButtons>
                </div>
            </div>
            <div class="pagination-section">
                <div class="pagination">
                    <p class="date_display">{{ monthNowName }} {{ yearNow }}</p>
                    <div class="pagination-btn">
                        <CamBtn variant="transparent" @click="prevPage" :disabled="!isPrevPage">
                            <fa icon="angle-left"></fa>
                        </CamBtn>
                        <CamBtn variant="transparent" @click="nextPage" :disabled="!isNextPage">
                            <fa icon="angle-right"></fa>
                        </CamBtn>
                    </div>
                </div>
                <div class="pagination_info">
                    <p>{{ $t('activity.found', [txs.length]) }}</p>
                    <button @click="updateHistory">
                        <fa icon="sync"></fa>
                    </button>
                </div>
            </div>
        </div>
        <div class="tx_table" ref="list" data-cy="tx-table-activity">
            <div class="tx_list" v-show="showList">
                <virtual-list
                    v-show="txs.length > 0"
                    :data-key="'id'"
                    :data-sources="txsProcessed"
                    :data-component="RowComponent"
                    :keeps="20"
                    ref="vlist"
                    :estimate-size="txsProcessed.length"
                    :extra-props="{
                        //@ts-ignore
                        indexData: getIndexData(this),
                    }"
                    class="list"
                ></virtual-list>
                <div v-if="txs.length === 0" class="empty">
                    <p>{{ $t('activity.empty') }}</p>
                </div>
            </div>
            <div v-if="!showList" class="loading">
                <Spinner class="spinner"></Spinner>
                <p>{{ $t('activity.loading') }}</p>
            </div>
        </div>
    </div>
</template>
<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import {
    ITransactionData,
    ITransactionDataProcessed,
    TransactionType,
} from '@/store/modules/history/types'

import TxRow from '@/components/wallet/activity/TxRow.vue'
import RadioButtons from '@/components/misc/RadioButtons.vue'
import Spinner from '@/components/misc/Spinner.vue'

type ModeKeyType = 'all' | 'transfer' | 'swap' | 'stake'

//@ts-ignore
import VirtualList from 'vue-virtual-scroll-list'
import { AvaNetwork } from '@/js/AvaNetwork'
import ExportCsvModal from '@/components/modals/ExportCsvModal.vue'
import ExportAvaxCsvModal from '@/components/modals/ExportAvaxCsvModal.vue'
import CamBtn from '@/components/CamBtn.vue'

const PAGE_LIMIT = 100

const YEAR_MIN = 2020
const MONTH_MIN = 8

@Component({
    name: 'activity',
    components: {
        ExportAvaxCsvModal,
        ExportCsvModal,
        Spinner,
        TxRow,
        RadioButtons,
        VirtualList,
        CamBtn,
    },
})
export default class Activity extends Vue {
    mode: ModeKeyType = 'all'
    modes = [
        this.$t('activity.mode1'),
        this.$t('activity.mode2'),
        this.$t('activity.mode3'),
        this.$t('activity.mode4'),
    ]
    modeKey: ModeKeyType[] = ['all', 'transfer', 'swap', 'stake']
    isLoading = false
    pageNow = 0
    RowComponent = TxRow

    monthNow = 0
    yearNow = 0

    listH = 100

    $refs!: {
        csv_modal: ExportCsvModal
        avax_csv_modal: ExportAvaxCsvModal
    }

    openCsvModal() {
        this.$refs.csv_modal.open()
    }

    openAvaxCsvModal() {
        this.$refs.avax_csv_modal.open()
    }

    get showList(): boolean {
        if (this.isUpdatingAll || this.isLoading) return false
        return true
    }

    get isUpdatingAll(): boolean {
        return this.$store.state.History.isUpdatingAll
    }

    get isNextPage() {
        let now = new Date()
        if (this.yearNow < now.getFullYear()) return true
        if (this.monthNow < now.getMonth()) return true
        return false
    }

    get isPrevPage() {
        // if (this.yearNow  now.getFullYear()) return true
        if (this.monthNow === MONTH_MIN && this.yearNow === YEAR_MIN) return false
        return true
    }

    get monthNowName() {
        return this.$t(`activity.months.${this.monthNow}`)
    }

    get hasExplorer() {
        let network: AvaNetwork | null = this.$store.state.Network.selectedNetwork
        if (!network?.explorerUrl) {
            return false
        }
        return true
    }

    getIndexData(virtualList: any) {
        console.log('virtualIndex', virtualList.index)
    }

    mounted() {
        this.updateHistory()
        let now = new Date()
        this.yearNow = now.getFullYear()
        this.monthNow = now.getMonth()
        this.scrollToTop()
        this.setScrollHeight()
    }
    deleted() {}

    updateHistory() {
        this.$store.dispatch('History/updateAllTransactionHistory')
    }
    get monthGroups(): any {
        let res: any = {}
        let txs = this.txs

        for (var i = 0; i < txs.length; i++) {
            let tx = txs[i]
            let date = new Date(tx.timestamp)
            // let mom = moment(tx.timestamp)
            let month = date.getMonth()
            let year = date.getFullYear()
            let key = `${month}/${year}`
            if (res[key]) {
                res[key].push(tx)
            } else {
                res[key] = [tx]
            }
        }
        return res
    }

    get allTxs(): ITransactionData[] {
        return this.$store.state.History.allTransactions
    }

    get txs(): ITransactionData[] {
        let txs
        switch (this.mode) {
            case 'transfer':
                txs = this.txsTransfer
                break
            case 'swap':
                txs = this.txsSwap
                break
            case 'stake':
                txs = this.txsStake
                break
            default:
                txs = this.allTxs
                break
        }

        let filtered = txs.filter((tx) => {
            let date = new Date(tx.timestamp)

            if (date.getMonth() === this.monthNow && date.getFullYear() === this.yearNow) {
                return true
            }
            return false
        })
        return filtered
    }

    get txsProcessed(): ITransactionDataProcessed[] {
        let txs = this.txs

        let res = txs.map((tx, index) => {
            let showMonth = false
            let showDay = false

            if (index === 0) {
                showMonth = true
                showDay = true
            } else {
                let txBefore = txs[index - 1]

                let date = new Date(tx.timestamp)
                let dateBefore = new Date(txBefore.timestamp)

                if (dateBefore.getMonth() !== date.getMonth()) {
                    showMonth = true
                    showDay = true
                } else if (dateBefore.getDay() !== date.getDay()) {
                    showDay = true
                }
            }

            return {
                ...tx,
                isMonthChange: showMonth,
                isDayChange: showDay,
            }
        })
        return res
    }

    get pageAmount(): number {
        return Math.floor(this.txs.length / PAGE_LIMIT)
    }

    prevPage() {
        if (this.monthNow === 0) {
            this.yearNow = this.yearNow - 1
            this.monthNow = 11
        } else {
            this.monthNow = this.monthNow - 1
        }
        this.scrollToTop()
        this.setScrollHeight()
    }

    nextPage() {
        if (this.monthNow === 11) {
            this.yearNow = this.yearNow + 1
            this.monthNow = 0
        } else {
            this.monthNow = this.monthNow + 1
        }
        this.scrollToTop()
        this.setScrollHeight()
    }

    get txsTransfer(): ITransactionData[] {
        let txs: ITransactionData[] = this.allTxs
        let transferTypes: TransactionType[] = ['base', 'create_asset', 'operation']

        return txs.filter((tx) => {
            let txType = tx.type
            if (transferTypes.includes(txType)) return true

            return false
        })
    }

    get txsSwap(): ITransactionData[] {
        let txs: ITransactionData[] = this.allTxs
        let exportTypes: TransactionType[] = ['import', 'export', 'pvm_import', 'pvm_export']

        return txs.filter((tx) => {
            let txType = tx.type
            if (exportTypes.includes(txType)) return true
            return false
        })
    }

    get txsStake(): ITransactionData[] {
        let txs: ITransactionData[] = this.allTxs
        let stakeTypes: TransactionType[] = ['add_validator']

        return txs.filter((tx) => {
            let txType = tx.type
            if (stakeTypes.includes(txType)) return true
            return false
        })
    }

    scrollToTop() {
        //@ts-ignore
        this.$refs.vlist.scrollToIndex(0)
    }
    // The virtual scroll needs to be given a height in pixels
    setScrollHeight() {
        //@ts-ignore
        let h = this.$refs.list.clientHeight
        this.listH = h
    }
}
</script>
<style scoped lang="scss">
@use '../../styles/abstracts/mixins';

.activity_page {
    position: relative;
    display: grid;
    grid-template-rows: max-content 1fr;
    padding-bottom: 14px;
}

.explorer_warning {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;

    h1 {
        font-weight: normal;
        margin-bottom: 14px;
        color: #fff;
    }

    .warning_body {
        display: flex;
        flex-direction: column;
        max-width: 380px;
        background-color: var(--secondary-color);
        color: #fff;
        padding: 30px;
        border-radius: 12px;
    }
}

.header {
    display: flex;
    flex-direction: row;
    align-items: center;

    p {
        margin: 0px 24px !important;
        color: var(--primary-color-light);
        @include mixins.typography-subtitle-1;
    }
}

.settings {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 12px;

    .pagination-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;

        .pagination-btn {
            display: flex;
            gap: 0.1rem;
        }
    }
}

.tx_table {
    margin-top: 0.5rem;
    border-top: 2px solid var(--border-color);
}

.tx_list {
    position: relative;
}

.table_headers {
    display: grid;
    grid-template-columns: 1fr 1fr;
}

.month_group {
    padding-bottom: 30px;
    border-bottom: 1px solid var(--bg-light);
    margin-bottom: 30px;

    &:last-of-type {
        border: none;
    }
}
.month_label {
    position: sticky;
    top: 0px;
}

.cols {
    height: 100%;
}

.empty,
.loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: var(--spacing-space-lg);
    border-radius: var(--border-radius-xl);
    margin-top: 1rem;
}

.spinner {
    font-size: 32px;
    margin-bottom: 22px;
    color: #1d82bb;
}

.pagination {
    display: flex;
    flex-direction: row;
    align-items: center;
    p {
        margin-right: 12px !important;
    }
    button {
        width: 24px;
        height: 24px;
        border-radius: 3px;
        border: 1px solid var(--secondary-color);
        color: var(--secondary-color);
        margin-left: 6px;
        opacity: 0.6;
        transition-duration: 0.1s;

        &:hover {
            opacity: 1;
        }

        &[disabled] {
            border-color: var(--primary-color-light);
            color: var(--primary-color-light);
            opacity: 0.4;
        }
    }
}

.date_display {
    @include mixins.typography-subtitle-1;
}

.filter_col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.filter_cont {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    label {
        @include mixins.typography-caption;
        color: var(--primary-color);
    }
}

.pagination_info {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    @include mixins.typography-caption;
    color: var(--primary-color-light);
    transition-duration: 0.1s;

    button {
        margin-left: 14px;
        color: var(--secondary-color);
        opacity: 0.6;
        &:hover {
            opacity: 1;
        }
    }
}

.csv_buttons {
    display: flex;
    gap: 1rem;
}

@include mixins.medium-device {
    .pagination {
        p {
            @include mixins.typography-body-1;
        }
    }
}

@include mixins.mobile-device {
    .settings {
        display: flex;
        flex-direction: column-reverse;
        align-items: flex-start;
        gap: 1.5rem;
    }

    .filter_col {
        grid-row: 2;
        justify-content: center;
    }

    .csv_buttons {
        flex-direction: column;
    }

    .pagination {
        justify-content: space-between;
        button {
            width: 35px;
            height: 35px;
        }
    }

    .pagination_info {
        justify-content: flex-start;
    }
}
</style>
