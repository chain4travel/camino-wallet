import router from '@/router'
import store from '@/store'
import Vue from 'vue'
import VueMeta from 'vue-meta'

import i18n from '@/plugins/i18n'
import vuetify from '@/plugins/vuetify'
import BootstrapVue from 'bootstrap-vue'
import { Datetime } from 'vue-datetime'
import 'vue-datetime/dist/vue-datetime.css'

import AliasPicker from '../manage/AliasPicker.vue'
import AccountCard from './AccountCard.vue'
import AccountKycItem from './AccountKycItem.vue'
import Settings from './Settings.vue'
Vue.use(VueMeta)
Vue.use(BootstrapVue)
Vue.component('datetime', Datetime)

function selectAccountMenuItem(type: string) {
    switch (type) {
        case 'alias':
            return AliasPicker
        case 'kyc':
            return AccountKycItem
        case 'kyb':
            return AccountKycItem
        case 'user':
            return Settings
        default:
            return AccountCard
    }
}

export const mountAccountMenu = (el: string, props: any) => {
    const { setAccount, dispatchNotification, dispatchSetNewName, closeSelect } = props
    const MyPlugin = {
        install(Vue) {
            Vue.prototype.globalHelper = () => {
                return {
                    closeSelect: () => closeSelect(),
                    setAccount: (acc) => setAccount(acc),
                    dispatchNotification: (params) => dispatchNotification(params),
                    dispatchSetNewName: () => dispatchSetNewName(),
                    updateStore: (type, params) => props.updateStore(type, params),
                }
            }
        },
    }
    Vue.use(MyPlugin)
    const app = new Vue({
        router,
        store,
        vuetify,
        i18n,
        data: {},
        created: function () {},
        render: (createElement) => {
            const context = {
                props: props,
            }
            return createElement(selectAccountMenuItem(props.type), context)
        },
    })
    app.$mount(el)
}
