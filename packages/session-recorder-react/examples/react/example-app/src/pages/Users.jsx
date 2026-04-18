import { useState, useEffect } from 'react'

export default function Users() {
  const [users, setUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const exportCSV = () => {
    const header = 'ID,Name,Username,Email,Phone,Website,Company'
    const rows = filteredUsers.map(
      (user) =>
        `${user.id},"${user.name}","${user.username}","${user.email}","${user.phone}","${user.website}","${user.company?.name ?? ''}"`,
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'users.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('https://jsonplaceholder.typicode.com/users')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      setError('Failed to load users')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Users</h1>
          <p className="subtitle">Data from jsonplaceholder.typicode.com</p>
        </div>
        <button
          className="btn-export"
          onClick={exportCSV}
          disabled={filteredUsers.length === 0}
        >
          Export CSV
        </button>
      </header>

      <input
        className="search-input"
        type="search"
        placeholder="Search by name, username or email…"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {error && (
        <div className="error">
          {error}
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {loading && <div className="loading">Loading users…</div>}

      {!loading && !error && (
        <div className="grid">
          {filteredUsers.map((user) => (
            <div key={user.id} className="user-card">
              <div className="user-card-header">
                <span className="user-avatar">{user.name.charAt(0)}</span>
                <div>
                  <h3>{user.name}</h3>
                  <p className="username">@{user.username}</p>
                </div>
              </div>
              <div className="user-card-body">
                <p>
                  <span className="label">Email</span>
                  <a href={`mailto:${user.email}`}>{user.email}</a>
                </p>
                <p>
                  <span className="label">Phone</span>
                  {user.phone}
                </p>
                <p>
                  <span className="label">Website</span>
                  <a href={`https://${user.website}`} target="_blank" rel="noreferrer">
                    {user.website}
                  </a>
                </p>
                <p>
                  <span className="label">Company</span>
                  {user.company?.name}
                </p>
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && searchTerm && (
            <p className="no-results">No users match &ldquo;{searchTerm}&rdquo;</p>
          )}
        </div>
      )}
    </section>
  )
}
