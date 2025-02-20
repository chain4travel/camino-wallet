import {
    addAccountToStorage,
    getAccountByIndex,
    getLocalStorageAccounts,
    overwriteAccountAtIndex,
    removeAccountByIndex,
    verifyAccountPassword,
} from '@/helpers/account_helper'
import { makeKeyfile } from '@/js/Keystore'
import MnemonicWallet from '@/js/wallets/MnemonicWallet'
import { SingletonWallet } from '@/js/wallets/SingletonWallet'
import { WalletType } from '@/js/wallets/types'
import { checkVerificationStatus } from '@/kyc_api'
import { AccountsState, ChangePasswordInput } from '@/store/modules/accounts/types'
import {
    AccessAccountInput,
    ImportKeyfileInput,
    RootState,
    SaveAccountInput,
    iUserAccountEncrypted,
} from '@/store/types'
import { createHash } from 'crypto'
import { Module } from 'vuex'

const accounts_module: Module<AccountsState, RootState> = {
    namespaced: true,
    state: {
        accounts: [],
        accountIndex: null,
        kycStatus: false,
        kybStatus: false,
    },
    mutations: {
        loadAccounts(state) {
            state.accounts = getLocalStorageAccounts()
        },
        deleteKey(state, wallet: WalletType) {
            if (state.accountIndex === null || !wallet.accountHash) return
            const acct = state.accounts[state.accountIndex]
            const delIndex = acct.wallet.keys.findIndex((w) => {
                const hash = createHash('sha256').update(w.key).digest()
                return hash.compare(wallet.accountHash ?? Buffer.alloc(0))
            })
            if (delIndex >= 0) {
                acct.baseAddresses.splice(delIndex, 1)
                acct.wallet.keys.splice(delIndex, 1)
            }
        },
    },
    actions: {
        onLogout({ state }) {
            state.accountIndex = null
        },

        async accessAccount({ state, dispatch }, input: AccessAccountInput) {
            let index = input.index
            let pass = input.pass

            let account = getAccountByIndex(index)
            if (!account) throw new Error('Account not found.')
            if (account.wallet.keys[index] === 'multisig') {
                index = 0
            }
            let data: ImportKeyfileInput = {
                password: pass,
                data:
                    account.wallet.keys[index] === 'multisig'
                        ? [account.wallet[0]]
                        : account.wallet,
            }

            await dispatch('importKeyfile', data, { root: true })
            state.accountIndex = account.wallet.keys[index] === 'multisig' ? 0 : index
        },

        // Creates a keystore file and saves to local storage
        async saveAccount({ state, dispatch, commit, getters, rootState }, data: SaveAccountInput) {
            try {
                // If this is an active account, get its index
                let activeAccount = getters.account
                let accountIndex = state.accountIndex
                let wallet = rootState.activeWallet as MnemonicWallet | SingletonWallet | null
                let pass = data.password
                if (!pass || wallet?.type === 'ledger') return

                let wallets = rootState.wallets as (MnemonicWallet | SingletonWallet)[]

                if (!wallet) throw new Error('No active wallet.')
                let activeIndex = wallets.findIndex((w) => w.id == wallet!.id)
                if (activeIndex >= wallets.length) activeIndex = 0

                let file = await makeKeyfile(wallets, pass, activeIndex, rootState.network.name)
                let baseAddresses = getters.baseAddresses
                let encryptedWallet: iUserAccountEncrypted = {
                    baseAddresses,
                    name: activeAccount?.name || data.accountName,
                    wallet: file,
                }

                // Remove old account, add new one
                if (accountIndex != null) {
                    overwriteAccountAtIndex(encryptedWallet, accountIndex)
                } else {
                    addAccountToStorage(encryptedWallet)
                    state.accountIndex = state.accounts.length
                }

                // No more volatile wallets
                rootState.volatileWallets = []
                rootState.warnUpdateKeyfile = false
                rootState.storedActiveWallet = rootState.activeWallet
                rootState.walletsDeleted = false
                commit('loadAccounts')
            } catch (e) {
                throw (<Error>e).message
            }
        },

        // If there is an active account, will remove it from local storage
        async deleteAccount({ state, dispatch, getters, commit }, password) {
            let acct = getters.account

            let passCorrect = await verifyAccountPassword(acct, password)
            if (!passCorrect) throw new Error('Invalid password.')
            let index = state.accountIndex

            if (!acct || index === null || index === undefined) return

            removeAccountByIndex(index)
            state.accountIndex = null

            // Update accounts
            commit('loadAccounts')
        },

        async changePassword({ state, getters, dispatch }, input: ChangePasswordInput) {
            let index = state.accountIndex
            let account: iUserAccountEncrypted = getters.account

            if (!account || !index) return

            let oldPassCorrect = await verifyAccountPassword(account, input.passOld)
            if (!oldPassCorrect) throw new Error('Previous password invalid.')

            // Remove current wallet file
            if (!index) removeAccountByIndex(index)
            // Save with new password
            dispatch('saveAccount', {
                password: input.passNew,
                accountName: account.name,
            })
        },

        // Used to save volatile keys into the active account
        async saveKeys({ dispatch, getters, state }, pass: string) {
            let index = state.accountIndex
            let account: iUserAccountEncrypted = getters.account

            if (index === null || index === undefined) return

            let passCorrect = await verifyAccountPassword(account, pass)
            if (!passCorrect) throw new Error('Invalid password.')

            // Save with volatile keys
            dispatch('saveAccount', {
                password: pass,
                accountName: account.name,
            })
        },

        async updateKycStatus({ state, rootState, dispatch }) {
            if (!rootState.activeWallet || rootState.activeWallet.type === 'ledger') return null
            const wallet = rootState.activeWallet as SingletonWallet | MnemonicWallet
            const privKey = wallet.getStaticKeyPair()?.getPrivateKey().toString('hex')
            if (!privKey) return null
            try {
                let { kycStatus, kybStatus } = await checkVerificationStatus(privKey)
                state.kycStatus = kycStatus
                state.kybStatus = kybStatus
            } catch (e) {
                console.log((e as Error).message)
                state.kycStatus = false
            }
        },
    },
    getters: {
        name(state, getters) {
            return getters.account?.name ?? 'Account'
        },

        hasAccounts(state) {
            return state.accounts.length > 0
        },

        baseAddresses(state, getters, rootState: RootState) {
            let wallets = rootState.wallets
            return wallets.map((w: WalletType) => {
                return w.getEvmAddress()
            })
        },

        baseAddressesNonVolatile(state, getters, rootState: RootState) {
            let wallets = rootState.wallets.filter((w) => {
                return !rootState.volatileWallets.includes(w)
            })

            return wallets.map((w: WalletType) => {
                return w.getEvmAddress()
            })
        },

        account(state): iUserAccountEncrypted | null {
            if (state.accountIndex === null) return null
            return state.accounts[state.accountIndex]
        },

        accountIndex(state: AccountsState): number | null {
            return state.accountIndex
        },

        kycStatus(state: AccountsState): boolean {
            return state.kycStatus
        },
        kybStatus(state: AccountsState): boolean {
            return state.kybStatus
        },
    },
}

export default accounts_module
