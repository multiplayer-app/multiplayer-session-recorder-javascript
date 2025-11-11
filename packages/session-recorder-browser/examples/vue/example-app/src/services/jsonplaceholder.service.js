import axios from 'axios'

const baseUrl = 'https://jsonplaceholder.typicode.com'

const api = axios.create({
  baseURL: baseUrl
})

export const jsonPlaceholderService = {
  async getPosts() {
    const response = await api.get('/posts')
    return response.data
  },

  async createPost(payload) {
    const response = await api.post('/posts', payload, {
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      }
    })
    return response.data
  },

  async getUsers() {
    const response = await api.get('/users')
    return response.data
  }
}

export default jsonPlaceholderService
