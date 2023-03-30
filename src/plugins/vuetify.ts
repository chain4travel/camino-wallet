import Vue from 'vue'
import Vuetify, {
    VApp,
    VBtn,
    VIcon,
    VList,
    VMain,
    VNavigationDrawer,
    VRadio,
    VRadioGroup,
    VTab,
    VTabItem,
    VTabsItems,
    VTabs,
    VTextField,
    VTooltip,
    VSpacer,
} from 'vuetify/lib'

import { library } from '@fortawesome/fontawesome-svg-core'
import {
    faAngleLeft,
    faAngleRight,
    faArrowLeft,
    faArrowRight,
    faBars,
    faBoxes,
    faCamera,
    faCaretDown,
    faCheckCircle,
    faCheckSquare,
    faChevronDown,
    faCog,
    faCopy,
    faCreditCard,
    faDna,
    faDollarSign,
    faDownload,
    faExchangeAlt,
    faExclamationTriangle,
    faExpand,
    faEye,
    faEyeSlash,
    faFileExcel,
    faFilter,
    faFont,
    faGlobe,
    faHistory,
    faInfoCircle,
    faKey,
    faLink,
    faList,
    faListOl,
    faLock,
    faMinus,
    faPlus,
    faPrint,
    faQrcode,
    faQuestionCircle,
    faQuoteRight,
    faRandom,
    faSearch,
    faShare,
    faSignInAlt,
    faSignOutAlt,
    faSpinner,
    faStar,
    faSync,
    faTimes,
    faTimesCircle,
    faTint,
    faTrash,
    faUnlink,
    faUnlock,
    faUpload,
    faUsers,
    faVideo,
    faFileCsv,
    faExternalLinkAlt,
    faExternalLinkSquareAlt,
    faPen,
} from '@fortawesome/free-solid-svg-icons'

import { faBtc, faGoogle } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(
    faBtc,
    faGoogle,
    faAngleLeft,
    faAngleRight,
    faArrowLeft,
    faArrowRight,
    faBars,
    faBoxes,
    faCamera,
    faCaretDown,
    faCheckCircle,
    faCheckSquare,
    faChevronDown,
    faCog,
    faCopy,
    faCreditCard,
    faDna,
    faDollarSign,
    faDownload,
    faExchangeAlt,
    faExclamationTriangle,
    faExpand,
    faEye,
    faEyeSlash,
    faFileCsv,
    faFileExcel,
    faFilter,
    faFont,
    faGlobe,
    faHistory,
    faInfoCircle,
    faKey,
    faLink,
    faList,
    faListOl,
    faLock,
    faMinus,
    faPlus,
    faPrint,
    faQrcode,
    faQuestionCircle,
    faQuoteRight,
    faRandom,
    faSearch,
    faShare,
    faSignInAlt,
    faSignOutAlt,
    faSpinner,
    faStar,
    faSync,
    faTimes,
    faTimesCircle,
    faTint,
    faTrash,
    faUnlink,
    faUnlock,
    faUpload,
    faUsers,
    faVideo,
    faFileCsv,
    faExternalLinkAlt,
    faExternalLinkSquareAlt,
    faPen
)

Vue.component('fa', FontAwesomeIcon)

Vue.use(Vuetify, {
    components: {
        VApp,
        VBtn,
        VIcon,
        VList,
        VMain,
        VNavigationDrawer,
        VRadio,
        VRadioGroup,
        VTab,
        VTabItem,
        VTabsItems,
        VTabs,
        VTextField,
        VTooltip,
        VSpacer,
    },
})

export default new Vuetify({
    theme: {
        themes: {
            light: {
                primary: '#42b983',
                secondary: '#06f',
                accent: '#82B1FF',
                error: '#ff9090',
                info: '#2196F3',
                success: '#4CAF50',
                warning: '#ecce73',
            },
        },
    },
    icons: {
        iconfont: 'mdiSvg',
    },
})
