<template>
  <section class="demo-page">
    <PageHeader title="Axios Demo" subtitle="Using Axios HTTP client for HTTP requests" />

    <div class="two-column-layout">
      <div class="column column-form">
        <div class="demo-section">
          <h3>POST Request - Create Post</h3>
          <form @submit.prevent="onSubmit" class="demo-form">
            <div class="form-group">
              <label for="title">Title</label>
              <input
                id="title"
                type="text"
                v-model="postForm.title"
                placeholder="Enter post title"
                :class="{ error: !postForm.title && submitted }"
                required
              />
            </div>
            <div class="form-group">
              <label for="body">Body</label>
              <textarea
                id="body"
                rows="4"
                v-model="postForm.body"
                placeholder="Enter post body"
                :class="{ error: !postForm.body && submitted }"
                required
              ></textarea>
            </div>
            <div class="form-group">
              <label for="userId">User ID</label>
              <input
                id="userId"
                type="number"
                v-model.number="postForm.userId"
                placeholder="Enter user ID"
                :class="{ error: !postForm.userId && submitted }"
                required
              />
            </div>
            <button type="submit" class="btn btn-primary" :disabled="creating">
              {{ creating ? 'Creating...' : 'Create Post' }}
            </button>
          </form>

          <div v-if="createError" class="error-message">{{ createError }}</div>
          <div v-if="createdPost" class="success-card">
            <h4>Post Created Successfully!</h4>
            <pre>{{ JSON.stringify(createdPost, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <div class="column column-posts">
        <div class="demo-section">
          <div class="section-header">
            <h3>GET Request - Load Posts</h3>
            <button type="button" class="btn btn-primary" @click="loadPosts" :disabled="loading">
              {{ loading ? 'Loading...' : 'Load Posts' }}
            </button>
          </div>

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
          <div v-if="posts.length > 0" class="posts-list">
            <div v-for="post in posts.slice(0, 10)" :key="post.id" class="post-item">
              <span class="post-id">#{{ post.id }}</span>
              <span class="post-title">{{ post.title }}</span>
            </div>
          </div>
          <div v-else-if="!loading && !errorMessage" class="empty-state">
            <p>Click "Load Posts" to fetch posts from the API</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import jsonPlaceholderService from '../services/jsonplaceholder.service.js'

const posts = ref([])
const loading = ref(false)
const errorMessage = ref(null)

const creating = ref(false)
const createError = ref(null)
const createdPost = ref(null)
const submitted = ref(false)

const postForm = ref({
  title: '',
  body: '',
  userId: 1
})

const loadPosts = async () => {
  loading.value = true
  errorMessage.value = null
  try {
    const data = await jsonPlaceholderService.getPosts()
    posts.value = data
  } catch (err) {
    errorMessage.value = 'Failed to load posts'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const onSubmit = async () => {
  submitted.value = true
  if (!postForm.value.title || !postForm.value.body || !postForm.value.userId) {
    return
  }

  creating.value = true
  createError.value = null
  createdPost.value = null

  try {
    const created = await jsonPlaceholderService.createPost({
      title: postForm.value.title,
      body: postForm.value.body,
      userId: postForm.value.userId
    })
    createdPost.value = created
  } catch (err) {
    createError.value = 'Failed to create post'
    console.error(err)
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.demo-page {
  display: grid;
  gap: 2rem;
}

.two-column-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: start;
}

.column {
  display: flex;
  flex-direction: column;
}

.demo-section {
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  height: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text, #0f172a);
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.9375rem;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: var(--primary, #2563eb);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-dark, #1e40af);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid var(--error, #dc2626);
  color: var(--error, #dc2626);
  border-radius: 8px;
  margin-top: 1rem;
}

.posts-list {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}

.post-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-hover, #f1f5f9);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 8px;
  transition: all 0.2s;
}

.post-item:hover {
  background: var(--surface, #fff);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.post-id {
  font-weight: 600;
  color: var(--primary, #2563eb);
  min-width: 3rem;
}

.post-title {
  color: var(--text, #0f172a);
  flex: 1;
}

.demo-form {
  display: grid;
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.form-group {
  display: grid;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: var(--text, #0f172a);
  font-size: 0.9375rem;
}

.form-group input,
.form-group textarea {
  padding: 0.75rem;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.2s;
  background: var(--surface, #fff);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary, #2563eb);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-group input.error,
.form-group textarea.error {
  border-color: var(--error, #dc2626);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--text-muted, #64748b);
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.success-card {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: #f0fdf4;
  border: 1px solid var(--success, #16a34a);
  border-radius: 8px;
}

.success-card h4 {
  margin: 0 0 1rem;
  color: var(--success, #16a34a);
  font-size: 1.125rem;
}

.success-card pre {
  margin: 0;
  padding: 1rem;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.875rem;
  color: var(--text, #0f172a);
}

.empty-state {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-muted, #64748b);
  font-style: italic;
}

@media (max-width: 1024px) {
  .two-column-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .demo-section {
    padding: 1.5rem;
  }

  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .section-header h3 {
    font-size: 1.25rem;
  }
}
</style>
