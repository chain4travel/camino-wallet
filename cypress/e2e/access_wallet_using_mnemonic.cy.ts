import { expect } from 'chai'
import '@cypress/xpath'
import { changeNetwork, accessWallet, addKopernikusNetwork, acceptCookies } from '../utils/utils'

describe('Wallet Access Mnemonic', () => {
    before(() => {
        cy.visit('/')
    })

    it('open suite/open wallet using mnemonic', () => {
        acceptCookies();
        addKopernikusNetwork(cy)
        //changeNetwork(cy);
        accessWallet(cy, 'mnemonic')
    })
})
