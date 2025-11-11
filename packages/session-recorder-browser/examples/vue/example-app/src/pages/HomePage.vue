<template>
  <section class="home-hero">
    <div class="hero-content">
      <h1 class="hero-title">Vue Example App</h1>
      <p class="hero-subtitle">
        A modern Vue application demonstrating HTTP requests, component architecture, and best practices.
      </p>
      <div class="hero-actions">
        <router-link to="/posts" class="btn btn-primary">View Posts</router-link>
        <router-link to="/users" class="btn btn-secondary">View Users</router-link>
      </div>
    </div>
  </section>

  <section class="features">
    <h2 class="features-title">Features</h2>
    <div class="features-grid">
      <div class="feature-card">
        <div class="feature-icon">📄</div>
        <h3>Posts Page</h3>
        <p>Browse and explore posts from JSONPlaceholder API using Axios.</p>
        <router-link to="/posts" class="feature-link">Explore Posts →</router-link>
      </div>
      <div class="feature-card">
        <div class="feature-icon">👥</div>
        <h3>Users Page</h3>
        <p>View user profiles with contact information and company details.</p>
        <router-link to="/users" class="feature-link">View Users →</router-link>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🔌</div>
        <h3>Axios Demo</h3>
        <p>Learn how to make GET and POST requests using Axios HTTP client.</p>
        <router-link to="/http-client" class="feature-link">Try Axios →</router-link>
      </div>
      <div class="feature-card">
        <div class="feature-icon">🌐</div>
        <h3>Fetch API Demo</h3>
        <p>See how to use the native Fetch API for HTTP requests in Vue.</p>
        <router-link to="/fetch" class="feature-link">Try Fetch →</router-link>
      </div>
    </div>
  </section>
</template>

<script setup>
// Home page component
</script>

<style scoped>
.home-hero {
  text-align: center;
  padding: 4rem 2rem;
  background: linear-gradient(135deg, var(--primary, #2563eb) 0%, var(--primary-dark, #1e40af) 100%);
  color: white;
  border-radius: 16px;
  margin-bottom: 4rem;
}

.hero-content {
  max-width: 700px;
  margin: 0 auto;
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  margin: 0 0 1rem;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 1.25rem;
  margin: 0 0 2rem;
  opacity: 0.95;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
  font-size: 1rem;
}

.btn-primary {
  background: white;
  color: var(--primary, #2563eb);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.features {
  margin-top: 4rem;
}

.features-title {
  font-size: 2rem;
  font-weight: 600;
  margin: 0 0 2rem;
  text-align: center;
  color: var(--text, #111);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.feature-card {
  padding: 2rem;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  border-color: var(--primary, #2563eb);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--text, #111);
}

.feature-card p {
  color: var(--text-muted, #666);
  line-height: 1.6;
  margin: 0 0 1rem;
}

.feature-link {
  color: var(--primary, #2563eb);
  text-decoration: none;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: gap 0.2s;
}

.feature-link:hover {
  gap: 0.5rem;
  text-decoration: underline;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }

  .hero-subtitle {
    font-size: 1rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
