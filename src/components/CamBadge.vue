<template>
    <div :class="badgeClass" :style="style">
        <label :class="size">{{ label }}</label>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import { CSSProperties } from 'vue'

enum BadgeVariant {
    Default = 'default',
    Primary = 'primary',
    Positive = 'positive',
    Warning = 'warning',
    Negative = 'negative',
    Verified = 'verified',
}

@Component
export default class CamBadge extends Vue {
    @Prop({ default: 'default' }) readonly variant?: BadgeVariant
    @Prop() label!: string
    @Prop({ default: 'medium' }) size?: 'small' | 'medium'
    @Prop() style?: CSSProperties

    get badgeClass() {
        return `camino__badge camino__${this.variant}--badge`
    }
}
</script>

<style lang="scss" scoped>
.camino__badge {
    width: fit-content;
    display: flex;
    align-items: center;
    padding: 1px 8px;
    border-radius: 4px;
}
.camino__default--badge {
    background: var(--tailwind-slate-slate-800);
    color: var(--tailwind-slate-slate-300);
}

.camino__primary--badge {
    background: rgba(0, 133, 255, 0.2);
    color: var(--camino-brand-too-blue-to-be-true);
}

.camino__positive--badge {
    background: rgba(9, 222, 107, 0.2);
    color: var(--camino-success-light);
}

.camino__warning--badge {
    background: rgba(229, 162, 31, 0.2);
    color: var(--camino-warning-light);
}

.camino__negative--badge {
    background: rgba(229, 67, 31, 0.2);
    color: var(--camino-error-light);
}

.camino__verified--badge {
    background: var(--camino-aphrodite-aqua);
    color: var(--tailwind-slate-slate-800);
}

.small,
.medium {
    font-family: Inter;
    letter-spacing: 1.6px;
    text-align: center;
    text-transform: uppercase;
    font-weight: 600;
    line-height: 18px;
    font-variant-numeric: lining-nums tabular-nums slashed-zero;
    font-feature-settings: 'ss01' on;
    font-size: 10px;
}

.small {
    font-size: 10px;
}

.medium {
    font-size: 12px;
}

[data-theme='light'] {
    .camino__primary--badge {
        background: #0085ff33;
    }

    .camino__positive--badge {
        background: var(--camino-success-light);
        color: #ffff;
    }

    .camino__warning--badge {
        background: var(--camino-warning-light);
        color: #ffff;
    }

    .camino__negative--badge {
        background: var(--camino-error-light);
        color: #ffff;
    }
}
</style>
