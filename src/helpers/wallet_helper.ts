import { ava, bintools } from '@/AVA'
import {
    buildBulkTransfer,
    buildCreateNftFamilyTx,
    buildEvmTransferERCNftTx,
    buildEvmTransferErc20Tx,
    buildEvmTransferNativeTx,
    buildMintNftTx,
} from '@/js/TxHelper'
import { WalletType } from '@/js/wallets/types'
import { AmountOutput } from '@c4tplatform/caminojs/dist/apis/avm'
import { UnsignedTx } from '@c4tplatform/caminojs/dist/apis/platformvm'

import { BulkOrder, ITransaction } from '@/components/wallet/transfer/types'
import { BN, Buffer } from '@c4tplatform/caminojs/dist'
import { UTXO as AVMUTXO } from '@c4tplatform/caminojs/dist/apis/avm/utxos'
import {
    ClaimAmountParams,
    ClaimType,
    DepositOffer,
    UTXO as PlatformUTXO,
    UTXOSet as PlatformUTXOSet,
} from '@c4tplatform/caminojs/dist/apis/platformvm'
import { PayloadBase } from '@c4tplatform/caminojs/dist/utils'

import { ValidatorRaw } from '@/components/misc/ValidatorList/types'
import { ChainIdType, ZeroBN } from '@/constants'
import { web3 } from '@/evm'
import { bnToBig } from '@/helpers/helper'
import { getStakeForAddresses } from '@/helpers/utxo_helper'
import ERCNftToken from '@/js/ERCNftToken'
import Erc20Token from '@/js/Erc20Token'
import MnemonicWallet from '@/js/wallets/MnemonicWallet'
import { MultisigWallet } from '@/js/wallets/MultisigWallet'
import { SingletonWallet } from '@/js/wallets/SingletonWallet'
import { GetValidatorsResponse } from '@/store/modules/platform/types'
import { MultisigAliasParams } from '@c4tplatform/caminojs/dist/apis/platformvm'
import { OutputOwners, SignatureError } from '@c4tplatform/caminojs/dist/common'
import { ModelDepositOfferSig } from '@c4tplatform/signavaultjs'
import AvaAsset from '@/js/AvaAsset'
class WalletHelper {
    static async getStake(wallet: WalletType): Promise<BN> {
        let addrs = wallet.getAllAddressesP()
        return await getStakeForAddresses(addrs)
    }

    static async createNftFamily(
        wallet: WalletType,
        name: string,
        symbol: string,
        groupNum: number
    ) {
        const fromAddresses = wallet.getAllAddressesX()
        const changeAddress = wallet.getChangeAddressAvm()
        const minterAddress = wallet.getCurrentAddressAvm()

        let utxoSet = wallet.utxoset

        let unsignedTx = await buildCreateNftFamilyTx(
            name,
            symbol,
            groupNum,
            fromAddresses,
            minterAddress,
            changeAddress,
            utxoSet
        )

        let signed = await wallet.signX(unsignedTx)
        return await ava.XChain().issueTx(signed)
    }

    static async mintNft(
        wallet: WalletType,
        mintUtxo: AVMUTXO,
        payload: PayloadBase,
        quantity: number,
        owners: string[]
    ) {
        let ownerAddress = wallet.getCurrentAddressAvm()
        for (let i = owners.length; i < quantity; ++i) {
            owners.push(ownerAddress)
        }
        let changeAddress = wallet.getChangeAddressAvm()
        let sourceAddresses = wallet.getAllAddressesX()

        let utxoSet = wallet.utxoset
        let tx = await buildMintNftTx(
            mintUtxo,
            payload,
            owners,
            changeAddress,
            sourceAddresses,
            utxoSet
        )
        let signed = await wallet.signX(tx)
        return await ava.XChain().issueTx(signed)
    }

    static async issueBatchTx(
        wallet: WalletType,
        chainId: ChainIdType,
        orders: (ITransaction | AVMUTXO)[],
        addr: string,
        memo: Buffer | undefined
    ): Promise<string> {
        if (chainId === 'P') {
            if (orders.length !== 1 || !(orders[0] as ITransaction).asset)
                throw new Error('Can only process 1 fungible order')
            const order = orders[0] as ITransaction
            return await this.platformBaseTx(wallet, order.amount, addr, memo ?? Buffer.alloc(0))
        }

        let unsignedTx = await wallet.buildUnsignedTransaction(orders, addr, memo)
        const tx = await wallet.signX(unsignedTx)
        const txId: string = await ava.XChain().issueTx(tx)

        return txId
    }

    static async issueBulkTx(
        wallet: WalletType,
        asset: AvaAsset,
        orders: BulkOrder[],
        memo: Buffer | undefined
    ): Promise<string> {
        const fromAddresses = wallet.getAllAddressesX()
        const changeAddress = wallet.getChangeAddressAvm()

        let unsignedTx = buildBulkTransfer(
            fromAddresses,
            [changeAddress],
            wallet.getUTXOSet(),
            orders,
            asset,
            memo
        )
        const tx = await wallet.signX(unsignedTx)
        return await ava.XChain().issueTx(tx)
    }

    static async validate(
        wallet: WalletType,
        nodeID: string,
        amt: BN,
        start: Date,
        end: Date,
        delegationFee: number,
        rewardAddress?: string,
        utxos?: PlatformUTXO[]
    ): Promise<string> {
        let utxoSet = wallet.getPlatformUTXOSet()

        // If given custom UTXO set use that
        if (utxos) {
            utxoSet = new PlatformUTXOSet()
            utxoSet.addArray(utxos)
        }

        const pAddressStrings = wallet.getAllAddressesP()
        const signerAddresses = wallet.getSignerAddresses('P')
        const nodeOwner = wallet.getStaticAddress('P')

        let stakeAmount = amt

        // If reward address isn't given use index 0 address
        if (!rewardAddress) {
            rewardAddress = wallet.getPlatformRewardAddress()
        }

        // For change address use first available on the platform chain
        let changeAddress = wallet.getFirstAvailableAddressPlatform()

        let stakeReturnAddr = wallet.getCurrentAddressPlatform()

        // Convert dates to unix time
        let startTime = new BN(Math.round(start.getTime() / 1000))
        let endTime = new BN(Math.round(end.getTime() / 1000))

        const unsignedTx = await ava.PChain().buildCaminoAddValidatorTx(
            utxoSet,
            [pAddressStrings, signerAddresses], // from
            [changeAddress], // change
            nodeID,
            {
                address: nodeOwner,
                auth: [[0, nodeOwner]],
            },
            startTime,
            endTime,
            stakeAmount,
            [rewardAddress]
        )

        let tx = await wallet.signP(unsignedTx)
        return await ava.PChain().issueTx(tx)
    }

    static async delegate(
        wallet: WalletType,
        nodeID: string,
        amt: BN,
        start: Date,
        end: Date,
        rewardAddress?: string,
        utxos?: PlatformUTXO[]
    ): Promise<string> {
        let utxoSet = wallet.getPlatformUTXOSet()
        const pAddressStrings = wallet.getAllAddressesP()
        const signerAddresses = wallet.getSignerAddresses('P')

        // If given custom UTXO set use that
        if (utxos) {
            utxoSet = new PlatformUTXOSet()
            utxoSet.addArray(utxos)
        }

        // If reward address isn't given use index 0 address
        if (!rewardAddress) {
            rewardAddress = wallet.getPlatformRewardAddress()
        }

        let stakeReturnAddr = wallet.getPlatformRewardAddress()

        // For change address use first available on the platform chain
        let changeAddress = wallet.getFirstAvailableAddressPlatform()

        // Convert dates to unix time
        let startTime = new BN(Math.round(start.getTime() / 1000))
        let endTime = new BN(Math.round(end.getTime() / 1000))

        const unsignedTx = await ava.PChain().buildAddDelegatorTx(
            utxoSet,
            [stakeReturnAddr],
            [pAddressStrings, signerAddresses],
            [changeAddress],
            nodeID,
            startTime,
            endTime,
            amt,
            [rewardAddress] // reward address
        )

        const tx = await wallet.signP(unsignedTx)
        return await ava.PChain().issueTx(tx)
    }

    static async getAddressState(address: string): Promise<BN> {
        return await ava.PChain().getAddressStates(address)
    }

    static async getRegisteredNode(address: string): Promise<string> {
        return await ava.PChain().getRegisteredShortIDLink(address)
    }

    static async registerNodeTx(
        wallet: WalletType,
        nodePrivateKey: string,
        oldNodeID: string | undefined,
        newNodeID: string | undefined,
        address: string,
        nodeAddress?: string,
        utxos?: PlatformUTXO[]
    ): Promise<string | undefined> {
        let utxoSet = wallet.getPlatformUTXOSet()

        // If given custom UTXO set use that
        if (utxos) {
            utxoSet = new PlatformUTXOSet()
            utxoSet.addArray(utxos)
        }

        const pAddressStrings = wallet.getAllAddressesP()
        if (nodeAddress) {
            // Multisig case, put node address as signer in UTx
            pAddressStrings.push(nodeAddress)
        }

        const signerAddresses = wallet.getSignerAddresses('P')

        const consortiumMemberAuthCredentials: [number, Buffer | string][] = [
            [0, pAddressStrings[0]],
        ]

        const threshold =
            wallet.type === 'multisig' ? (wallet as MultisigWallet)?.keyData?.owner?.threshold : 1

        const unsignedTx = await ava.PChain().buildRegisterNodeTx(
            utxoSet,
            [pAddressStrings, signerAddresses], // from + possible signers
            [], // change
            oldNodeID,
            newNodeID,
            address,
            consortiumMemberAuthCredentials,
            undefined, // memo
            undefined, // asOf
            Number(threshold)
        )

        try {
            const tx = await wallet.signP(unsignedTx, [nodePrivateKey])
            return await ava.PChain().issueTx(tx)
        } catch (err) {
            if (err instanceof SignatureError) {
                return undefined
            } else {
                throw err
            }
        }
    }

    static async addValidatorTx(
        wallet: WalletType,
        nodeID: string,
        startTime: BN,
        endTime: BN,
        stakeAmount: BN,
        endTxTime?: number
    ): Promise<string | undefined> {
        const pAddressStrings = wallet.getAllAddressesP()
        const utxoSet = wallet.getPlatformUTXOSet()
        const signerAddresses = wallet.getSignerAddresses('P')
        const nodeOwner = wallet.getStaticAddress('P')

        let rewardAddress = wallet.getPlatformRewardAddress()

        const unsignedTx = await ava.PChain().buildCaminoAddValidatorTx(
            utxoSet,
            [pAddressStrings, signerAddresses],
            pAddressStrings,
            nodeID,
            {
                address: nodeOwner,
                auth: [[0, nodeOwner]],
            },
            startTime,
            endTime,
            stakeAmount,
            [rewardAddress]
        )

        try {
            const tx = await wallet.signP(unsignedTx, undefined, endTxTime)
            return await ava.PChain().issueTx(tx)
        } catch (err) {
            throw err
        }
    }

    static async platformBaseTx(
        wallet: WalletType,
        amount: BN,
        toAddress: string,
        memo: Buffer,
        utxos?: PlatformUTXO[]
    ): Promise<string> {
        let utxoSet = wallet.getPlatformUTXOSet()

        // If given custom UTXO set use that
        if (utxos) {
            utxoSet = new PlatformUTXOSet()
            utxoSet.addArray(utxos)
        }

        const pAddressStrings = wallet.getAllAddressesP()
        const signerAddresses = wallet.getSignerAddresses('P')

        const threshold =
            wallet.type === 'multisig' ? (wallet as MultisigWallet)?.keyData?.owner?.threshold : 1

        const unsignedTx = await ava.PChain().buildBaseTx(
            utxoSet,
            amount,
            [toAddress],
            [pAddressStrings, signerAddresses], // from + possible signers
            [], // change
            memo,
            undefined, // asOf
            undefined, // lockTime
            1, // toThreshold
            threshold // changeThreshold
        )

        let tx = await wallet.signP(unsignedTx)
        return await ava.PChain().issueTx(tx)
    }

    static async getEthBalance(wallet: WalletType) {
        let bal = await web3.eth.getBalance(wallet.ethAddress)
        return new BN(bal)
    }

    static async sendEth(
        wallet: WalletType,
        to: string,
        amount: BN, // in wei
        gasPrice: BN,
        gasLimit: number
    ) {
        let fromAddr = '0x' + wallet.getEvmAddress()

        let tx = await buildEvmTransferNativeTx(fromAddr, to, amount, gasPrice, gasLimit)

        let signedTx = await wallet.signEvm(tx)

        let txHex = signedTx.serialize().toString('hex')
        let hash = await web3.eth.sendSignedTransaction('0x' + txHex)
        return hash.transactionHash
    }

    static async sendErc20(
        wallet: WalletType,
        to: string,
        amount: BN,
        gasPrice: BN,
        gasLimit: number,
        token: Erc20Token
    ) {
        let fromAddr = '0x' + wallet.getEvmAddress()
        let tx = await buildEvmTransferErc20Tx(fromAddr, to, amount, gasPrice, gasLimit, token)

        let signedTx = await wallet.signEvm(tx)
        let txHex = signedTx.serialize().toString('hex')
        let hash = await web3.eth.sendSignedTransaction('0x' + txHex)
        return hash.transactionHash
    }

    static async sendERCNft(
        wallet: WalletType,
        to: string,
        gasPrice: BN,
        gasLimit: number,
        token: ERCNftToken,
        tokenId: string,
        amount: BN
    ) {
        let fromAddr = '0x' + wallet.getEvmAddress()
        let tx = await buildEvmTransferERCNftTx(
            fromAddr,
            to,
            gasPrice,
            gasLimit,
            token,
            tokenId,
            amount
        )
        let signedTx = await wallet.signEvm(tx)
        let txHex = signedTx.serialize().toString('hex')
        let hash = await web3.eth.sendSignedTransaction('0x' + txHex)
        return hash.transactionHash
    }

    static async estimateTxGas(wallet: WalletType, tx: any) {
        let fromAddr = '0x' + wallet.getEvmAddress()
        let estGas = await tx.estimateGas({ from: fromAddr })
        return Math.round(estGas * 1.1)
    }

    static async estimateGas(wallet: WalletType, to: string, amount: BN, token: Erc20Token) {
        let from = '0x' + wallet.getEvmAddress()
        let tx = token.createTransferTx(to, amount)
        let estGas = await tx.estimateGas({
            from: from,
        })
        // Return 10% more
        return Math.round(estGas * 1.1)
    }

    static async findNodeIDInCurrentValidators(nodeID: string): Promise<any> {
        let subnets = await ava.PChain().getSubnets()
        let res = (await ava
            .PChain()
            .getCurrentValidators(subnets[0].ids, [nodeID])) as GetValidatorsResponse
        let validator = res.validators[0]
        return validator
    }

    static async getClaimables(address: string, txID?: string) {
        try {
            //Claimables Params
            let responseClaimable = await ava.PChain().getClaimables([
                {
                    locktime: '0',
                    threshold: 1,
                    addresses: [address],
                },
            ])
            return responseClaimable.claimables[0]
        } catch (e) {
            console.error(e)
        }
    }

    static async buildClaimTx(
        address: string,
        amount: BN,
        activeWallet: WalletType,
        rewardOwnerAddress: string
    ) {
        let addressRewardOwnerBuffer = ava.PChain().parseAddress(rewardOwnerAddress)

        //let arrSigner = [rewardOwnerAddress]
        let signerAddresses = activeWallet.getSignerAddresses('P')

        //signerAddresses = arrSigner.concat(signerAddresses)

        const threshold =
            activeWallet.type === 'multisig'
                ? (activeWallet as MultisigWallet)?.keyData?.owner?.threshold
                : 1

        let utxoSet = activeWallet.utxoset

        const unsignedTx = await ava.PChain().buildClaimTx(
            //@ts-ignore
            utxoSet,
            [[rewardOwnerAddress], signerAddresses],
            [],
            undefined, // memo
            new BN(0), //as Of
            Number(threshold),
            [
                {
                    amount: amount,
                    claimType: ClaimType.VALIDATOR_REWARD,
                    owners: new OutputOwners([addressRewardOwnerBuffer], ZeroBN, 1),
                    sigIdxs: [0],
                } as ClaimAmountParams,
            ]
        )

        try {
            let tx = await activeWallet.signP(unsignedTx)
            return await ava.PChain().issueTx(tx)
        } catch (err) {
            if (err instanceof SignatureError) {
                return undefined
            } else {
                throw err
            }
        }
    }

    static async findPendingValidator(nodeID: string): Promise<ValidatorRaw> {
        let subnets = await ava.PChain().getSubnets()
        let res = (await ava
            .PChain()
            .getPendingValidators(subnets[0].ids, [nodeID])) as GetValidatorsResponse
        let validator = res.validators[0]
        return validator
    }

    static async buildDepositClaimTx(
        wallet: WalletType,
        depositTxID: string,
        rewardOwner: OutputOwners,
        claimAmount: BN,
        claimValidator: boolean
    ) {
        const pAddressStrings = wallet.getAllAddressesP()
        const signerAddresses = wallet.getSignerAddresses('P')

        const claimAmountParam = {
            claimType: claimValidator
                ? ClaimType.VALIDATOR_REWARD
                : ClaimType.EXPIRED_DEPOSIT_REWARD,
            amount: claimAmount,
            owners: rewardOwner,
            sigIdxs: [0],
        } as ClaimAmountParams

        if (depositTxID) {
            claimAmountParam.id = bintools.cb58Decode(depositTxID)
            claimAmountParam.claimType = ClaimType.ACTIVE_DEPOSIT_REWARD
        }

        const unsignedTx = await ava
            .PChain()
            .buildClaimTx(
                wallet.platformUtxoset,
                [pAddressStrings, signerAddresses],
                [],
                Buffer.alloc(0),
                ZeroBN,
                1,
                [claimAmountParam]
            )

        try {
            const tx = await wallet.signP(unsignedTx)
            return await ava.PChain().issueTx(tx)
        } catch (err) {
            if (err instanceof SignatureError) {
                return undefined
            } else {
                throw err
            }
        }
    }

    static async buildDepositTx(
        wallet: WalletType,
        depositID: string,
        depositDuration: number,
        depositAmount: BN,
        restrictedOffer?: ModelDepositOfferSig,
        depositOfferOwner?: string,
        depositOwner?: string,
        rewardOwner?: string
    ) {
        const pAddressStrings = wallet.getAllAddressesP()
        const signerAddresses = wallet.getSignerAddresses('P')
        const depositOwnerAddress = bintools.parseAddress(
            depositOwner ? depositOwner : wallet.getPlatformRewardAddress(),
            'P'
        )

        const depositCreator = pAddressStrings[0]
        const depositCreatorAuth: [number, string | Buffer][] = [[0, depositCreator]]
        const unsignedTx = await ava
            .PChain()
            .buildDepositTx(
                restrictedOffer ? 1 : 0,
                wallet.platformUtxoset,
                [pAddressStrings, signerAddresses],
                [],
                depositID,
                depositDuration,
                new OutputOwners([depositOwnerAddress], ZeroBN, 1),
                restrictedOffer ? depositCreator : Buffer.alloc(20),
                restrictedOffer ? depositCreatorAuth : [],
                restrictedOffer && restrictedOffer.signature
                    ? [Buffer.from(restrictedOffer.signature, 'hex')]
                    : [],
                restrictedOffer && depositOfferOwner
                    ? [[wallet.type === 'multisig' ? 1 : 0, depositOfferOwner]]
                    : [],
                Buffer.alloc(0),
                ZeroBN,
                depositAmount,
                1,
                depositOwner ? [bintools.parseAddress(depositOwner as string, 'P')] : [],
                depositOwner ? 1 : 0
            )
        let tx = await wallet.signP(unsignedTx)
        return await ava.PChain().issueTx(tx)
    }

    static async buildUnlockDepositTx(wallet: WalletType, amount: BN, depositTxID: string) {
        const pAddressStrings = wallet.getAllAddressesP()
        const signerAddresses = wallet.getSignerAddresses('P')
        const unsignedTx = await ava
            .PChain()
            .buildUnlockDepositTx(
                wallet.platformUtxoset,
                [pAddressStrings, signerAddresses],
                Buffer.alloc(0),
                [
                    {
                        amount: amount.toNumber(),
                        depositTxID,
                    },
                ]
            )

        try {
            const tx = await wallet.signP(unsignedTx)
            return await ava.PChain().issueTx(tx)
        } catch (err) {
            if (err instanceof SignatureError) {
                return undefined
            } else {
                throw err
            }
        }
    }

    static async buildAddDepositOfferTx(wallet: WalletType, offer: DepositOffer) {
        const pAddressStrings = wallet.getAllAddressesP()
        const signerAddresses = wallet.getSignerAddresses('P')

        const creatorAddress = pAddressStrings[0]
        const creatorAuth: [number, Buffer | string][] = [[0, pAddressStrings[0]]]

        const unsignedTx = await ava
            .PChain()
            .buildAddDepositOfferTx(
                wallet.platformUtxoset,
                [pAddressStrings, signerAddresses],
                [],
                offer,
                creatorAddress,
                creatorAuth,
                Buffer.alloc(0),
                ZeroBN
            )
        let tx = await wallet.signP(unsignedTx)
        return await ava.PChain().issueTx(tx)
    }

    static getUnsignedTxType(utx: string): string {
        let unsignedTx = new UnsignedTx()
        unsignedTx.fromBuffer(Buffer.from(utx, 'hex'))
        return unsignedTx.getTransaction().getTypeName()
    }

    static getToAddressFromUtx(utx: UnsignedTx, msigAlias?: string) {
        const tx = utx.getTransaction()

        const el = tx?.getOuts()?.find((o) => {
            const _address =
                'P' +
                bintools.addressToString(
                    ava.getHRP(),
                    tx?.getBlockchainID().toString(),
                    o?.getAddresses()?.[0]
                )
            return _address !== msigAlias
        })

        if (el) {
            const toAddress = bintools.addressToString(
                ava.getHRP(),
                tx?.getBlockchainID().toString(),
                el?.getAddresses()?.[0]
            )

            return toAddress
        }
    }

    static getTotalAmountFromUtxTest(utx: UnsignedTx): number {
        let amount = 0
        const tx = utx.getTransaction()

        const output = tx.getOuts()[tx.getOuts().length - 1]?.getOutput() as AmountOutput
        amount += Number(bnToBig(output?.getAmount(), 9)?.toString())
        return amount
    }
    static getTotalAmountFromUtx(utx: UnsignedTx, toAddress: string): number {
        let amount = 0
        const hrp = ava.getHRP()
        const tx = utx.getTransaction()

        for (const out of tx.getOuts()) {
            const output = out?.getOutput() as AmountOutput

            for (const addr of output?.getAddresses()) {
                const hrAddress = bintools.addressToString(
                    hrp,
                    tx?.getBlockchainID().toString(),
                    addr
                )

                if (hrAddress === toAddress) {
                    amount += Number(bnToBig(output?.getAmount(), 9)?.toString())
                }
            }
        }

        return amount
    }

    static async scanForHdFunds(wlt: WalletType) {
        if (wlt.type !== 'singleton' || (wlt as SingletonWallet).getSeed() === '') return

        const seed = (wlt as SingletonWallet).getSeed()
        const mnemonic = (wlt as SingletonWallet).getMnemonic()
        const wallet = new MnemonicWallet(mnemonic, seed, true)
        await wallet.initialize()
        await wallet.getUTXOs()

        // Filter utxos containing destination address
        const UTXOs = wallet
            .getUTXOSet()
            .getAllUTXOs()
            ?.filter((utxo) => {
                const out = utxo.getOutput()
                const addrs = out.getAddresses()
                const hrp = ava.getHRP()
                const addrsClean = addrs.map((addr) => {
                    return bintools.addressToString(hrp, 'X', addr)
                })

                if (!addrsClean.includes((wlt as SingletonWallet)?.getCurrentAddressAvm())) {
                    return utxo
                }
            })
        const platformUTXOs = wallet
            .getPlatformUTXOSet()
            .getAllUTXOs()
            ?.filter((utxo) => {
                const out = utxo.getOutput()
                const addrs = out.getAddresses()
                const hrp = ava.getHRP()
                const addrsClean = addrs.map((addr) => {
                    return bintools.addressToString(hrp, 'P', addr)
                })

                if (!addrsClean.includes((wlt as SingletonWallet)?.getCurrentAddressPlatform())) {
                    return utxo
                }
            })

        return {
            wallet,
            UTXOs,
            platformUTXOs,
        }
    }

    static async sendMultisigAliasTxCreate(
        wallet: WalletType,
        addresses: string[],
        memo: string,
        threshold: number
    ) {
        const pchain = ava.PChain()
        const pAddressStrings = [wallet.getStaticAddress('P')]

        const multisigAliasParams: MultisigAliasParams = {
            memo: memo,
            owners: new OutputOwners(
                addresses.map((address: string) => pchain.parseAddress(address)),
                new BN(0),
                threshold
            ),
            auth: [],
        }

        const unsignedTx = await ava
            .PChain()
            .buildMultisigAliasTx(
                wallet.platformUtxoset,
                pAddressStrings,
                [],
                multisigAliasParams,
                undefined,
                ZeroBN
            )
        let tx = await wallet.signP(unsignedTx)
        return await ava.PChain().issueTx(tx)
    }

    static async sendMultisigAliasTxUpdate(
        wallet: WalletType,
        initialAddresses: string[],
        addresses: string[],
        memo: string,
        initialThreshold: number,
        threshold: number,
        multisigAliasAddress: string
    ) {
        const pchain = ava.PChain()

        if (!multisigAliasAddress) {
            throw new Error('Multisig alias address is required')
        }
        const multisigAliasParams: MultisigAliasParams = {
            id: pchain.parseAddress(multisigAliasAddress),
            memo: memo,
            owners: new OutputOwners(
                addresses.map((address: string) => pchain.parseAddress(address)),
                new BN(0),
                threshold
            ),
            auth: [[0, pchain.parseAddress(multisigAliasAddress)]],
        }

        const unsignedTx = await ava
            .PChain()
            .buildMultisigAliasTx(
                wallet.platformUtxoset,
                [[multisigAliasAddress], initialAddresses],
                [],
                multisigAliasParams,
                undefined,
                ZeroBN,
                initialThreshold
            )

        let tx = await wallet.signP(unsignedTx)
        return await ava.PChain().issueTx(tx)
    }
}

export { WalletHelper }
export type { DepositOffer }
