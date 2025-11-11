<template>
  <header class="ph">
    <div class="ph__titles">
      <h2 class="ph__title">{{ title }}</h2>
      <p v-if="subtitle" class="ph__subtitle">{{ subtitle }}</p>
    </div>
    <div class="ph__actions">
      <slot />
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.ph {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border, #e2e8f0);
}

.ph__title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text, #0f172a);
}

.ph__subtitle {
  margin: 0.5rem 0 0;
  color: var(--text-muted, #64748b);
  font-size: 1rem;
}
</style>
