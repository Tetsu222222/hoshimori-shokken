import { useState, useEffect } from 'react'

type Event = {
  id: number;
  slug: string;
  event_name: string;
  event_date: string;
  venue: string;
  start_time: string;
  capacity: number;
  end_time: string;
  classes: string; // JSON string from DB
  explanation_text: string;
  reservation_count: number;
}

export default function Admin() {
  const [events, setEvents] = useState<Event[]>([])
  const [password, setPassword] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [requirePasswordChange, setRequirePasswordChange] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [masterPassword, setMasterPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [editingEventId, setEditingEventId] = useState<number | null>(null)

  const initialNewEvent = {
    slug: '',
    event_name: '星の杜食堂 ',
    event_date: '',
    venue: '小ホール',
    start_time: '',
    capacity: 130,
    end_time: '',
    classes: '1S, 1L, 2S, 2L, 3S, 1D, 1E, 1N, 1P, 2D, 2E, 2N, 2P, 2R, 3D, 3S, 3P, 3R, 教職員',
    explanation_text: ''
  }
  const [newEvent, setNewEvent] = useState(initialNewEvent)

  const fetchAdminData = async () => {
    if (!isLoggedIn) return
    try {
      const evRes = await fetch('https://backend.s-yuuui.workers.dev/api/admin/events', { headers: { 'Authorization': `Bearer ${password}` }})
      const evData = await evRes.json()
      setEvents(Array.isArray(evData) ? evData : [])
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    const savedPassword = sessionStorage.getItem('admin_password')
    if (savedPassword && !isLoggedIn) {
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

  useEffect(() => { fetchAdminData() }, [isLoggedIn, requirePasswordChange])

  const handleLogout = () => {
    setIsLoggedIn(false)
    sessionStorage.removeItem('admin_password')
    setPassword('')
  }

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
      if (data.requirePasswordChange) setRequirePasswordChange(true)
    } else setLoginError('パスワードが間違っています')
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('https://backend.s-yuuui.workers.dev/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_password: password, new_password: newPassword })
    })
    if (res.ok) {
      setPassword(newPassword)
      sessionStorage.setItem('admin_password', newPassword)
      setRequirePasswordChange(false)
      alert('パスワードを変更しました')
    } else setLoginError('エラーが発生しました')
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('https://backend.s-yuuui.workers.dev/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ master_password: masterPassword, new_password: newPassword })
    })
    if (res.ok) {
      alert('パスワードをリセットしました。新しいパスワードでログインしてください。')
      setShowReset(false)
      setPassword('')
      setNewPassword('')
      setMasterPassword('')
    } else {
      alert('マスターパスワードが正しくありません')
    }
  }

  const handleCreateOrUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 保存時にバリデーションと変換を行う
    let processedSlug = newEvent.slug.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    processedSlug = processedSlug.replace(/[^a-zA-Z0-9_-]/g, '')
    
    if (!processedSlug) {
      alert('URL用の名前には半角英数字を入力してください。')
      return
    }

    if (new Date(newEvent.start_time) >= new Date(newEvent.end_time)) {
      alert('受付終了日時は、受付開始日時よりも後の時間を設定してください。')
      return
    }

    const method = editingEventId ? 'PUT' : 'POST'
    const url = editingEventId ? `https://backend.s-yuuui.workers.dev/api/admin/events/${editingEventId}` : 'https://backend.s-yuuui.workers.dev/api/admin/events'
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${password}` },
      body: JSON.stringify({
        ...newEvent,
        slug: processedSlug,
        classes: typeof newEvent.classes === 'string' ? newEvent.classes.split(',').map(c => c.trim()).filter(c => c) : newEvent.classes,
        start_time: newEvent.start_time + ':00+09:00',
        end_time: newEvent.end_time + ':00+09:00'
      })
    })
    if (res.ok) {
      setShowCreate(false)
      setEditingEventId(null)
      setNewEvent(initialNewEvent)
      fetchAdminData()
    } else {
      const data = await res.json()
      alert(data.error || 'エラーが発生しました')
    }
  }

  const handleEditClick = (ev: Event) => {
    setEditingEventId(ev.id)
    setNewEvent({
      slug: ev.slug,
      event_name: ev.event_name,
      event_date: ev.event_date,
      venue: ev.venue || '',
      start_time: ev.start_time.substring(0, 16),
      capacity: ev.capacity,
      end_time: ev.end_time.substring(0, 16),
      classes: JSON.parse(ev.classes).join(', '),
      explanation_text: ev.explanation_text
    })
    setShowCreate(true)
  }

  const handleDeleteEvent = async (id: number) => {
    const input = prompt('このイベントを完全に削除するには、半角大文字で DELETE と入力してください。関連するすべての予約データも削除されます。')
    if (input !== 'DELETE') {
      if (input !== null) alert('入力内容が正しくないため、削除を中止しました。')
      return
    }
    await fetch(`https://backend.s-yuuui.workers.dev/api/admin/events/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${password}` }})
    fetchAdminData()
  }

  if (!isLoggedIn) {
    if (showReset) return (
      <div className="card" style={{maxWidth: '400px', margin: '40px auto'}}>
        <h2>パスワードのリセット</h2>
        <form onSubmit={handleResetPassword}>
          <div className="form-group"><label>マスターパスワード</label><input type="password" value={masterPassword} onChange={e => setMasterPassword(e.target.value)} required /></div>
          <div className="form-group"><label>新しいパスワード</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></div>
          <button type="submit" className="btn-block">リセット実行</button>
          <button type="button" onClick={() => setShowReset(false)} className="btn-outline btn-block" style={{marginTop: '10px'}}>戻る</button>
        </form>
      </div>
    )

    return (
      <div className="card" style={{maxWidth: '400px', margin: '40px auto'}}>
        <h2>管理者ログイン</h2>
        {loginError && <div className="error-message">{loginError}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group"><label>パスワード</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          <button type="submit" className="btn-block">ログイン</button>
          <div style={{marginTop: '20px', fontSize: '13px'}}>
            <a href="#" onClick={(e) => { e.preventDefault(); setShowReset(true); }} style={{color: '#94a3b8'}}>パスワード変更</a>
          </div>
        </form>
      </div>
    )
  }

  if (requirePasswordChange) return (
    <div className="card" style={{maxWidth: '400px', margin: '40px auto'}}>
      <h2>パスワード変更</h2>
      <p style={{fontSize: '14px', color: '#64748b', marginBottom: '20px'}}>セキュリティのため初期パスワードから変更してください。</p>
      <form onSubmit={handleChangePassword}>
        <div className="form-group"><label>新しいパスワード</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></div>
        <button type="submit" className="btn-block">保存してログイン</button>
      </form>
    </div>
  )

  const copyAnnouncement = (ev: Event) => {
    const text = `【星の杜食堂のお知らせ】
保護者の皆さま
お昼の時間に校内で●●●●●を●●●円で販売をします。
日時：${ev.event_date.replace(/-/g, '/')}の昼休み
場所：${ev.venue || ''}
対象：生徒・教職員

事前予約：${ev.start_time.substring(0, 16).replace('T', ' ').replace(/-/g, '/')}

・事前予約フォームは、生徒自身が入力してください。
・フォームに所属とお名前を入力し、最後に出てくる画面のスクリーンショットをお取りください。
・お1人1回予約できます。重複は削除します。
・整理券の番号順ではなく購入いただけます。お支払いは当日です。
・トッピングなどは先着順です。
・当日販売分も予定しています。
・お箸やスプーン持参にご協力ください。

予約フォーム：${window.location.origin}/${ev.slug}`
    
    navigator.clipboard.writeText(text)
    alert('お知らせ文をコピーしました！')
  }

  const copyToClipboard = (slug: string) => {
    const fullUrl = `${window.location.origin}/${slug}`
    navigator.clipboard.writeText(fullUrl)
    alert(`コピーしました！\n${fullUrl}`)
  }

  return (
    <div style={{maxWidth: '850px', margin: '0 auto', width: '100%', paddingBottom: '50px'}}>
      <div style={{marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 style={{color: 'var(--primary-blue)', margin: 0}}>星の杜食堂 予約システム管理画面</h1>
        <div style={{display: 'flex', gap: '10px'}}>
          <button onClick={() => window.location.href = '/admin/urls'} className="btn-outline" style={{padding: '5px 15px', fontSize: '13px', backgroundColor: '#f1f5f9'}}>URL短縮管理</button>
          <button onClick={handleLogout} className="btn-outline" style={{padding: '5px 15px', fontSize: '13px'}}>ログアウト</button>
        </div>
      </div>

      <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '15px'}}>
        <button onClick={() => { setShowCreate(!showCreate); if(showCreate) {setEditingEventId(null); setNewEvent(initialNewEvent);} }} className="btn-secondary">
          {showCreate ? '閉じる' : '新規イベント作成'}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{marginBottom: '20px', textAlign: 'left'}}>
          <h3>{editingEventId ? 'イベントの編集' : '新規イベント作成'}</h3>
          <form onSubmit={handleCreateOrUpdateEvent}>
            <div className="form-group">
              <label>URL用の名前 (例: 20260424)</label>
              <input 
                type="text" 
                value={newEvent.slug} 
                onChange={e => setNewEvent({...newEvent, slug: e.target.value})} 
                disabled={editingEventId !== null}
                required 
                placeholder="半角英数字" 
              />
              {editingEventId !== null && <p style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px'}}>※URLは後から変更できません</p>}
            </div>
            <div className="form-group"><label>イベント名</label><input type="text" value={newEvent.event_name} onChange={e => setNewEvent({...newEvent, event_name: e.target.value})} required /></div>
            <div className="form-group"><label>開催日</label><input type="date" value={newEvent.event_date} onChange={e => setNewEvent({...newEvent, event_date: e.target.value})} required /></div>
            <div className="form-group"><label>開催場所</label><input type="text" value={newEvent.venue} onChange={e => setNewEvent({...newEvent, venue: e.target.value})} /></div>
            <div className="form-group"><label>受付開始日時</label><input type="datetime-local" value={newEvent.start_time} onChange={e => setNewEvent({...newEvent, start_time: e.target.value})} required /></div>
            <div className="form-group"><label>受付終了日時</label><input type="datetime-local" value={newEvent.end_time} onChange={e => setNewEvent({...newEvent, end_time: e.target.value})} required /></div>
            <div className="form-group"><label>定員</label><input type="number" value={newEvent.capacity} onChange={e => setNewEvent({...newEvent, capacity: Number(e.target.value)})} required /></div>
            <div className="form-group"><label>所属 (カンマ区切り)</label><input type="text" value={newEvent.classes} onChange={e => setNewEvent({...newEvent, classes: e.target.value})} required /></div>
            <div className="form-group"><label>説明文</label><textarea value={newEvent.explanation_text} onChange={e => setNewEvent({...newEvent, explanation_text: e.target.value})} rows={4} /></div>
            <button type="submit" className="btn-block">{editingEventId ? '更新する' : '作成する'}</button>
          </form>
        </div>
      )}

      {events.map(ev => (
        <div key={ev.id} className="card" style={{marginBottom: '15px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', padding: '15px 20px'}}>
          <div style={{flex: '1', minWidth: '200px'}}>
            <a href={`/${ev.slug}`} target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
              <h3 style={{margin: 0, color: 'var(--primary-blue)', fontSize: '18px', cursor: 'pointer'}} title="予約ページを開く">
                {ev.event_name} ↗
              </h3>
            </a>
            <p style={{margin: '4px 0', fontSize: '13px', color: 'var(--text-muted)'}}>
              URL: <strong 
                onClick={() => copyToClipboard(ev.slug)} 
                style={{cursor: 'pointer', color: 'var(--primary-blue)', textDecoration: 'underline'}}
                title="クリックしてフルURLをコピー"
              >
                /{ev.slug}
              </strong> | 予約: {ev.reservation_count} / {ev.capacity}
            </p>
          </div>
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
            <button onClick={() => copyAnnouncement(ev)} className="btn-outline" style={{padding: '8px 12px', fontSize: '12px', borderColor: 'var(--primary-blue)', color: 'var(--primary-blue)'}}>お知らせコピー</button>
            <button onClick={() => window.open(`/${ev.slug}/list`, '_blank')} className="btn-outline" style={{padding: '8px 12px', fontSize: '12px'}}>リスト表示</button>
            <button onClick={() => window.location.href = `https://backend.s-yuuui.workers.dev/api/admin/export?id=${ev.id}&password=${password}`} className="btn-outline" style={{padding: '8px 12px', fontSize: '12px'}}>CSV</button>
            <button onClick={() => handleEditClick(ev)} className="btn-secondary" style={{padding: '8px 12px', fontSize: '12px'}}>編集</button>
            <button onClick={() => handleDeleteEvent(ev.id)} className="btn-danger" style={{padding: '8px 12px', fontSize: '12px'}}>削除</button>
          </div>
        </div>
      ))}
    </div>
  )
}
