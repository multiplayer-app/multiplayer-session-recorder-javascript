<template>
  <article class="card">
    <header class="card-header">
      <h3 class="card-title">{{ user?.name }}</h3>
      <span class="badge">{{ '@' + user?.username }}</span>
    </header>
    <ul class="details">
      <li>
        <strong>Email:</strong>
        <a :href="'mailto:' + user?.email">{{ user?.email }}</a>
      </li>
      <li>
        <strong>Phone:</strong>
        <a :href="'tel:' + user?.phone">{{ user?.phone }}</a>
      </li>
      <li>
        <strong>Website:</strong>
        <a target="_blank" rel="noopener" :href="'https://' + (user?.website || '')">{{ user?.website }}</a>
      </li>
      <li><strong>Company:</strong> {{ user?.company?.name }}</li>
      <li><strong>City:</strong> {{ user?.address?.city }}</li>
    </ul>
  </article>
</template>

<script setup>
defineProps({
  user: {
    type: Object,
    default: null
  }
})
</script>

<style scoped>
.card {
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  background: var(--surface, #fff);
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--primary, #2563eb);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text, #0f172a);
  line-height: 1.4;
  flex: 1;
  min-width: 0;
}

.badge {
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid var(--border, #e2e8f0);
  background: var(--surface-hover, #f1f5f9);
  border-radius: 999px;
  padding: 0.375rem 0.75rem;
  color: var(--text-muted, #64748b);
  white-space: nowrap;
}

.details {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
  flex: 1;
}

.details li {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.details li strong {
  color: var(--text, #0f172a);
  font-weight: 600;
  min-width: 80px;
}

a {
  color: var(--primary, #2563eb);
  text-decoration: none;
  transition: color 0.2s;
}

a:hover {
  color: var(--primary-dark, #1e40af);
  text-decoration: underline;
}
</style>
