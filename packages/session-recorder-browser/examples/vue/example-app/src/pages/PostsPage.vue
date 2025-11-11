<template>
  <section class="page">
    <PageHeader title="Posts" subtitle="Data from jsonplaceholder.typicode.com" />

    <div v-if="error" class="error">
      Failed to load posts.
      <button type="button" @click="reload">Retry</button>
    </div>
    <div v-else-if="posts.length === 0" class="loading">Loading posts…</div>
    <div v-else class="grid">
      <PostCard v-for="post in posts.slice(0, 20)" :key="post.id" :post="post" />
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import PostCard from '../components/PostCard.vue'
import jsonPlaceholderService from '../services/jsonplaceholder.service.js'

const posts = ref([])
const error = ref(null)

const load = async () => {
  error.value = null
  posts.value = []
  try {
    const data = await jsonPlaceholderService.getPosts()
    posts.value = data
  } catch (err) {
    error.value = 'Failed to load posts'
    console.error(err)
  }
}

const reload = () => {
  load()
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.page {
  display: grid;
  gap: 2rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.loading {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted, #64748b);
  font-size: 1.125rem;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.error {
  padding: 1.5rem;
  border: 1px solid var(--error, #dc2626);
  background: #fef2f2;
  color: var(--error, #dc2626);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.error button {
  padding: 0.625rem 1.25rem;
  background: var(--error, #dc2626);
  color: white;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.error button:hover {
  background: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
