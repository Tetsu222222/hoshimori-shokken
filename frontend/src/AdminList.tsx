import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

type Reservation = {
  id: number;
  class_name: string;
  child_name: string;
  ticket_number: number;
  created_at: string;
}

export default function AdminList() {
  const { slug } = useParams()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [eventName, setEventName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // We need the password to access admin APIs.
    // In a real app, we'd use a cookie/token. For this simple local app, 
    // we'll ask the user to enter the password or pass it via query if needed.
    // However, the user wants a "new window". 
    // Let's try to get it from sessionStorage if available, or just ask.
    const password = sessionStorage.getItem('admin_password')
    if (!password) {
      const p = prompt('パスワードを入力してください')
      if (p) {
        sessionStorage.setItem('admin_password', p)
        window.location.reload()
      }
      return
    }

    const fetchData = async () => {
      try {
        const evRes = await fetch(`/api/events/${slug}`)
        const evData = await evRes.json()
        setEventName(evData.event_name)

        const res = await fetch(`/api/admin/events/${evData.id}/reservations`, {
          headers: { 'Authorization': `Bearer ${password}` }
        })
        if (res.status === 401) {
          sessionStorage.removeItem('admin_password')
          alert('認証エラーです。パスワードを再入力してください。')
          window.location.reload()
          return
        }
        const data = await res.json()
        setReservations(data)
      } catch (e) {
        setError('データの取得に失敗しました')
      }
    }
    fetchData()
  }, [slug])

  if (error) return <div className="card">{error}</div>

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: '40px' }}>
      <h1 style={{ textAlign: 'left', color: '#1e293b' }}>{eventName} 予約リスト</h1>
      <p style={{ color: '#64748b', marginBottom: '20px' }}>合計: {reservations.length} 名</p>
      
      <div className="table-container">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>番号</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>クラス</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>名前</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>予約日時</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map(r => (
              <tr key={r.id}>
                <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', fontWeight: 'bold' }}>{r.ticket_number}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{r.class_name}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>{r.child_name}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8' }}>{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }} className="no-print">
        <button onClick={() => window.print()} className="btn-outline">印刷する</button>
        <button onClick={() => window.close()} className="btn-secondary">閉じる</button>
      </div>

      <style>{`
        @media print {
          .no-print { display: none; }
          body { padding: 0; }
          .table-container { margin: 0; }
        }
      `}</style>
    </div>
  )
}
