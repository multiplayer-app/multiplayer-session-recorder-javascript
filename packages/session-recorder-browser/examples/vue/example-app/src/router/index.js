import { createRouter, createWebHistory } from 'vue-router'
import SessionRecorder from '@multiplayer-app/session-recorder-browser'
import HomePage from '../pages/HomePage.vue'
import PostsPage from '../pages/PostsPage.vue'
import UsersPage from '../pages/UsersPage.vue'
import HttpClientDemo from '../pages/HttpClientDemo.vue'
import FetchDemo from '../pages/FetchDemo.vue'

const routes = [
  { path: '/', name: 'Home', component: HomePage, meta: { title: 'Home' } },
  { path: '/posts', name: 'Posts', component: PostsPage, meta: { title: 'Posts' } },
  { path: '/users', name: 'Users', component: UsersPage, meta: { title: 'Users' } },
  { path: '/http-client', name: 'HttpClient', component: HttpClientDemo, meta: { title: 'HttpClient Demo' } },
  { path: '/fetch', name: 'Fetch', component: FetchDemo, meta: { title: 'Fetch API Demo' } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Track navigation
router.afterEach((to, from) => {
  SessionRecorder.navigation.record({
    path: to.path,
    url: to.fullPath,
    routeName: to.name || to.path,
    title: document.title,
    navigationType: to.meta.transition || 'push',
    framework: 'vue',
    source: 'router',
    params: to.params,
    query: to.query,
    meta: to.meta,
    metadata: {
      previousPath: from.path,
      previousUrl: from.fullPath
    }
  })
})

export default router
