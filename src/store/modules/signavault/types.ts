import { ModelMultisigTx } from '@/signavault_api'

export interface SignavaultState {
    transactions: MultisigTx[]
    importedTransactions: MultisigTx[]
}

export interface MultisigTx {
    tx: ModelMultisigTx
    state: number
}
