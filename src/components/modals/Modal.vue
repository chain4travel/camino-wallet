<template>
    <transition name="fade">
        <div class="modal_main" v-if="isActive">
            <div class="modal_bg" @click="bgclick" :icy="icy"></div>
            <div class="modal_container">
                <div :class="{ modal_body: true, 'overflow--hidden': isOverflowHidden }">
                    <div class="modal_topbar">
                        <div class="modal_title">
                            <h4>{{ title }}</h4>
                            <p v-if="subtitle" class="modal_subtitle">{{ subtitle }}</p>
                        </div>
                        <button
                            class="modalClose"
                            @click="close"
                            v-if="can_close"
                            data-cy="btn-modal-close"
                        >
                            <fa icon="times"></fa>
                        </button>
                    </div>
                    <slot></slot>
                </div>
            </div>
        </div>
    </transition>
</template>
<script lang="ts">
import 'reflect-metadata'
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component
export default class Modal extends Vue {
    @Prop({ default: 'Modal Title' }) title!: string
    @Prop({ default: '' }) subtitle!: string
    @Prop({ default: true }) can_close!: boolean
    @Prop({ default: false }) icy!: boolean
    @Prop() isKybModal?: boolean
    @Prop() canCloseKybModal?: boolean
    @Prop() isOverflowHidden?: boolean

    isActive: boolean = false

    destroyed() {
        setTimeout(() => (document.body.style.overflow = 'initial'), 1000)
    }

    public open() {
        this.isActive = true
        document.body.style.overflow = 'hidden'
    }

    bgclick() {
        if (!this.isKybModal && this.can_close) {
            this.close()
        }
    }

    public close() {
        this.$emit('beforeClose')
        if (this.isKybModal) {
            if (this.canCloseKybModal) {
                this.isActive = false
                document.body.style.overflow = 'initial'
            }
        } else {
            this.isActive = false
            document.body.style.overflow = 'initial'
        }
    }
}
</script>
<style scoped lang="scss">
@use '../../styles/abstracts/mixins';

.modal_topbar {
    background-color: var(--bg);
    border-bottom: var(--bg);
    color: var(--primary-color);
    border-bottom: 2px solid var(--bg-light);
    position: relative;
    padding: 10px 22px;
    display: flex;
    z-index: 1102;
    top: 0;
    left: 0;
    width: 100%;
}

.modal_title {
    @include mixins.typography-subtitle-1;
    text-align: left;
    flex-grow: 1;
    margin: 0;
    text-transform: capitalize;
}

.modal_subtitle {
    @include mixins.typography-caption;
}

.modalClose {
    @include mixins.typography-subtitle-1;
    font-weight: lighter;
    opacity: 0.5;
    &:hover {
        opacity: 1;
    }
}

.modal_main {
    z-index: 1101;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: auto;
    display: flex;
    overflow-y: hidden;
}
.modal_bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    vertical-align: center;
    align-items: center;

    &[icy] {
        backdrop-filter: blur(4px);
    }
}

.modal_body {
    width: max-content;
    max-width: 90%;
    min-height: 30px;
    background-color: var(--bg);
    box-shadow: 1px 1px 10px rgba(0, 0, 0, 0.5);
    margin: auto;
    z-index: 1103;
    position: absolute;
    inset: 50% auto auto 50%;
    transform: translate(-50%, -50%);
    border-radius: var(--border-radius-lg);
    overflow: auto;
    max-height: 90%;
}

.overflow--hidden {
    overflow: hidden;
}

@include mixins.mobile-device {
    .modal_body {
        position: absolute;
        width: max-content;
        margin: 0;
        padding-bottom: 20px;
        max-width: 100%;
        border-radius: var(--border-radius-lg);
        height: 'min-content';
        overflow: auto;
    }
}
</style>
