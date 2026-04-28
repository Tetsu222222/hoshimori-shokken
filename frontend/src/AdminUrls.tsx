import { useState, useEffect } from 'react'

type UrlEntry = {
  short_code: string;
  original_url: string;
  clicks: number;
  created_at: string;
}

export default function AdminUrls() {
  const [urls, setUrls] = useState<UrlEntry[]>([])
  const [password, setPassword] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [newUrl, setNewUrl] = useState({ original_url: '', custom_code: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchUrls = async () => {
    if (!isLoggedIn) return
    try {
      const res = await fetch('https://backend.s-yuuui.workers.dev/api/admin/urls', {
        headers: { 'Authorization': `Bearer ${password}` }
      })
      const data = await res.json()
      setUrls(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    const savedPassword = sessionStorage.getItem('admin_password')
    if (savedPassword) {
      setPassword(savedPassword)
      fetch('https://backend.s-yuuui.workers.dev/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: savedPassword })
      }).then(res => res.json()).then(data => {
        if (data.success) setIsLoggedIn(true)
      })
    }
  }, [])

  useEffect(() => {
    fetchUrls()
  }, [isLoggedIn])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('https://backend.s-yuuui.workers.dev/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    const data = await res.json()
    if (res.ok && data.success) {
      setIsLoggedIn(true)
      sessionStorage.setItem('admin_password', password)
    } else {
      setLoginError('パスワードが間違っています')
    }
  }

  const handleCreateUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch('https://backend.s-yuuui.workers.dev/api/admin/urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${password}`
        },
        body: JSON.stringify(newUrl)
      })
      if (res.ok) {
        setNewUrl({ original_url: '', custom_code: '' })
        fetchUrls()
      } else {
        const data = await res.json()
        alert(data.error || 'エラーが発生しました')
      }
    } catch (e) {
      alert('エラーが発生しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUrl = async (code: string) => {
    if (!confirm('この短縮URLを削除してもよろしいですか？')) return
    await fetch(`https://backend.s-yuuui.workers.dev/api/admin/urls/${code}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${password}` }
    })
    fetchUrls()
  }

  const copyToClipboard = (code: string) => {
    const fullUrl = `https://go.st2g.net/${code}`
    navigator.clipboard.writeText(fullUrl)
    alert(`コピーしました！\n${fullUrl}`)
  }

  if (!isLoggedIn) {
    return (
      <div className="card" style={{ maxWidth: '400px', margin: '40px auto' }}>
        <h2>管理者ログイン (URL管理)</h2>
        {loginError && <div className="error-message">{loginError}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>パスワード</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-block">ログイン</button>
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <a href="/admin" style={{ color: '#94a3b8', fontSize: '13px' }}>予約システム管理へ戻る</a>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', width: '100%', paddingBottom: '50px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: 'var(--primary-blue)', margin: 0 }}>URL短縮システム 管理画面</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.location.href = '/admin'} className="btn-outline" style={{ padding: '5px 15px', fontSize: '13px' }}>予約管理へ</button>
          <button onClick={() => { setIsLoggedIn(false); sessionStorage.removeItem('admin_password'); }} className="btn-outline" style={{ padding: '5px 15px', fontSize: '13px' }}>ログアウト</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '30px', textAlign: 'left' }}>
        <h3>新しい短縮URLを作成</h3>
        <form onSubmit={handleCreateUrl}>
          <div className="form-group">
            <label>元のURL (長いURL)</label>
            <input
              type="url"
              value={newUrl.original_url}
              onChange={e => setNewUrl({ ...newUrl, original_url: e.target.value })}
              placeholder="https://example.com/very/long/path"
              required
            />
          </div>
          <div className="form-group">
            <label>短縮コード (任意)</label>
            <input
              type="text"
              value={newUrl.custom_code}
              onChange={e => setNewUrl({ ...newUrl, custom_code: e.target.value })}
              placeholder="空欄にするとランダムで5文字発行されます"
            />
          </div>
          <button type="submit" className="btn-block" disabled={isSubmitting}>
            {isSubmitting ? '作成中...' : '短縮URLを作成する'}
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h3 style={{ margin: 0 }}>作成済みURL一覧</h3>
        <span style={{ fontSize: '14px', color: '#64748b' }}>全 {urls.length} 件</span>
      </div>

      {urls.map(url => (
        <div key={url.short_code} className="card" style={{ marginBottom: '15px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '15px 20px' }}>
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h3 style={{ margin: 0, color: 'var(--primary-blue)', fontSize: '18px' }}>
              go.st2g.net/<span onClick={() => copyToClipboard(url.short_code)} style={{ textDecoration: 'underline', cursor: 'pointer' }} title="クリックしてコピー">{url.short_code}</span>
            </h3>
            <p style={{ margin: '4px 0', fontSize: '13px', color: '#64748b', wordBreak: 'break-all' }}>
              転送先: <a href={url.original_url} target="_blank" rel="noreferrer" style={{ color: '#64748b' }}>{url.original_url}</a>
            </p>
            <p style={{ margin: '4px 0', fontSize: '12px', color: '#94a3b8' }}>
              作成日: {new Date(url.created_at).toLocaleDateString()} | クリック数: <strong>{url.clicks}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => copyToClipboard(url.short_code)} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }}>コピー</button>
            <button onClick={() => handleDeleteUrl(url.short_code)} className="btn-danger" style={{ padding: '8px 12px', fontSize: '12px' }}>削除</button>
          </div>
        </div>
      ))}

      {urls.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', background: '#fff', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
          URLがまだ登録されていません。
        </div>
      )}
    </div>
  )
}
