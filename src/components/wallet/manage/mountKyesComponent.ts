import router from '@/router'
import store from '@/store'
import Vue from 'vue'
import VueMeta from 'vue-meta'

import MyKeys from '@/components/wallet/manage/MyKeys.vue'
import i18n from '@/plugins/i18n'
import vuetify from '@/plugins/vuetify'
import BootstrapVue from 'bootstrap-vue'
import { Datetime } from 'vue-datetime'
import 'vue-datetime/dist/vue-datetime.css'
Vue.use(VueMeta)
Vue.use(BootstrapVue)
Vue.component('datetime', Datetime)

export const mountKyesComponent = (el: string, props: any) => {
    const { dispatchNotification, dispatchSetNewName, setAccount, isSuite: boolean } = props
    const MyPlugin = {
        install(Vue) {
            Vue.prototype.globalHelper = () => {
                return {
                    dispatchNotification: (params) => dispatchNotification(params),
                    dispatchSetNewName: () => dispatchSetNewName(),
                    updateStore: (type, params) => props.updateStore(type, params),
                    setAccount: (params) => setAccount(params),
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
            return createElement(MyKeys, context)
        },
    })
    app.$mount(el)
}
