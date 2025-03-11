import { MultisigTx, SignavaultState } from './types'
import { SignaVaultTx } from '@/signavault_api'
import { Module } from 'vuex'
import { RootState } from '@/store/types'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'

const signavault_module: Module<SignavaultState, RootState> = {
    namespaced: true,
    state: {
        transactions: [],
        importedTransactions: [],
    },
    getters: {
        transactions(state) {
            return state.transactions
        },
        transaction: (state) => (txID: string) => {
            return state.transactions.find((t) => t.tx.id === txID)
        },

        importedTransactions(state) {
            return state.importedTransactions
        },
    },
    mutations: {
        clear(state) {
            state.transactions = []
        },
        setTx(state, newTx: MultisigTx[]) {
            state.transactions = newTx
        },

        setImportedTx(state, newTx: MultisigTx[]) {
            state.importedTransactions = newTx
        },
        clearImported(state) {
            state.importedTransactions = []
        },
    },
    actions: {
        async updateTransaction({ commit, dispatch, rootState, rootGetters }) {
            const wallet = rootState.activeWallet
            if (!wallet || !(wallet instanceof MultisigWallet)) return commit('clear')

            if (wallet.wallets.length === 0) {
                console.log('no signing wallets connected')
                return commit('clear')
            }
            const signingKeyPair = wallet.wallets[0].getStaticKeyPair()
            if (!signingKeyPair) {
                console.log('wallet returned undefined staticKeyPair')
                return commit('clear')
            }

            const network = rootGetters['Network/selectedNetwork']
            if (!network) return commit('clear')

            try {
                const newTx = await SignaVaultTx(wallet.getStaticAddress('P'), signingKeyPair)
                commit(
                    'setTx',
                    newTx.map(
                        (mms): MultisigTx => ({
                            tx: mms,
                            state: wallet.getSignatureStatus(mms),
                        })
                    )
                )
                await dispatch('updateImportedMultiSigTransaction')
            } catch (e: any) {
                return commit('clear')
            }
        },
        async updateImportedMultiSigTransaction({ commit, rootState, rootGetters }) {
            try {
                const network = rootGetters['Network/selectedNetwork']
                if (!network) return commit('clearImported')

                const multisigWallets = rootState.wallets.filter(
                    (wallet) => wallet.type === 'multisig'
                )

                const allTxPromises = multisigWallets.map(async (wallet) => {
                    if (!(wallet instanceof MultisigWallet)) {
                        commit('clearImported')
                        return
                    }

                    const staticAddress = wallet.getStaticAddress('P')
                    const signingKeyPair = wallet.wallets[0]?.getStaticKeyPair()

                    if (!signingKeyPair) {
                        console.log('wallet returned undefined staticKeyPair')
                        commit('clearImported')
                        return
                    }

                    return await SignaVaultTx(staticAddress, signingKeyPair) // Get transactions for each wallet
                })

                const allTxResults = (await Promise.all(allTxPromises)).flat()

                const multisigTxs = allTxResults
                    .map((mms, index) => {
                        const wallet = multisigWallets[index]
                        if (!mms || !(wallet instanceof MultisigWallet)) return []

                        return {
                            tx: mms,
                            state: wallet.getSignatureStatus(mms),
                        }
                    })
                    .filter((tx: any) => tx.length !== 0) // Filter out empty results

                commit('setImportedTx', multisigTxs.flat())
            } catch (e: any) {
                console.error('Error fetching transactions:', e)
                commit('clearImported')
            }
        },
    },
}

export default signavault_module
