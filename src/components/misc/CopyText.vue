<template>
    <div class="copyBut" @click="copy">
        <!--        <fa icon="copy"></fa>-->
        <v-icon>mdi-content-copy</v-icon>
        <p class="text">
            <slot></slot>
        </p>
        <input ref="copytext" :value="value" />
    </div>
</template>
<script>
export default {
    props: {
        value: String,
        notificationMessage: String,
    },
    methods: {
        copy() {
            let copytext = this.$refs.copytext
            copytext.select()
            copytext.setSelectionRange(0, 99999)
            let { dispatchNotification } = this.globalHelper()
            dispatchNotification({
                message: this.notificationMessage
                    ? this.notificationMessage
                    : this.$t('notifications.copy_to_clipboard'),
                type: 'success',
            })
            document.execCommand('copy')
        },
    },
}
</script>
<style scoped lang="scss">
@use '../../styles/abstracts/mixins';
.copyBut {
    display: flex;
    width: max-content;
    align-items: center;
    cursor: pointer;
}
.copyBut input {
    width: 1px;
    position: absolute;
    opacity: 0;
}
.text {
    user-select: none;
    pointer-events: none;
    margin-left: 12px !important;
}

img {
    max-height: 18px;
    object-fit: contain;
}
input {
    pointer-events: none;
    user-select: none;
}
button {
    width: 100%;
    height: 100%;
    background-size: contain;
    background-position: center;
}
.v-icon {
    color: var(--primary-color);
    width: 20px;
    height: 20px;
    @include mixins.typography-subtitle-1;
}
</style>
