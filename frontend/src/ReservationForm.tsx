import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

type EventData = {
  id: number;
  cafeteria_name: string;
  event_name: string;
  explanation_text: string;
  event_date: string;
  venue: string;
  start_time: string;
  capacity: number;
  end_time: string;
  classes: string[];
  current_count: number;
}

export default function ReservationForm() {
  const { slug } = useParams()
  const [event, setEvent] = useState<EventData | null>(null)
  const [className, setClassName] = useState('')
  const [childName, setChildName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ticketNumber, setTicketNumber] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch(`https://backend.s-yuuui.workers.dev/api/events/${slug}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setEvent(data)
          if (data.classes?.length > 0) setClassName(data.classes[0])
        } else {
          setError('イベントが見つかりません。URLを確認してください。')
        }
      })
      .catch(() => setError('ネットワークエラーが発生しました。'))
  }, [slug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!className || !childName.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`https://backend.s-yuuui.workers.dev/api/events/${slug}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name: className, child_name: childName.trim() })
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setTicketNumber(data.ticket_number)
      } else {
        const msg = data.error === 'Not started' ? '予約期間前です。' :
                    data.error === 'Closed' || data.error === 'Full' ? '予約は終了しました。当日販売もありますので直接会場に来てください。' :
                    data.error === 'Already reserved' ? 'すでに予約済みです。' :
                    'エラーが発生しました。'
        setError(msg)
      }
    } catch (err) {
      setError('通信エラーが発生しました。')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (error && error.includes('見つかりません')) return <div className="card"><div className="error-message">{error}</div></div>
  if (!event) return <div className="card"><div className="loading">読み込み中...</div></div>

  if (ticketNumber !== null) {
    return (
      <div className="card">
        <h1 style={{color: 'var(--primary-blue)', fontSize: '28px', marginBottom: '15px'}}>{event.event_name}</h1>
        <p style={{ fontSize: '1.1em', margin: '10px 0' }}>予約完了！</p>
        <p style={{ fontSize: '20pt', fontWeight: 'bold', margin: '20px 0 5px', color: 'var(--text-dark)' }}>
          開催日：{event.event_date.replace(/-/g, '/')}
        </p>
        <div className="ticket-number">{ticketNumber}</div>
        <p style={{ color: '#ef4444' }}><strong>スクショを撮って当日見せてね！</strong></p>
      </div>
    )
  }

  // 日本語形式の時間を確実にパースする関数
  const parseLocalTime = (s: string) => {
    if (!s) return 0
    const match = s.match(/(\d+)-(\d+)-(\d+)[T ](\d+):(\d+)/)
    if (!match) return 0
    // ブラウザの現在地時間として解釈
    return new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3]),
      parseInt(match[4]),
      parseInt(match[5])
    ).getTime()
  }

  const startTime = parseLocalTime(event.start_time)
  const endTime = parseLocalTime(event.end_time)
  const currentTime = now.getTime()

  // 表示用に時間を整形
  const formatTime = (t: string) => t ? t.substring(0, 16).replace('T', ' ').replace(/-/g, '/') : ''

  if (currentTime < startTime) {
    return (
      <div className="card">
        <h1 style={{color: 'var(--primary-blue)', fontSize: '28px', marginBottom: '15px'}}>{event.event_name}</h1>
        <div className="error-message" style={{background: '#e0f2fe', borderColor: '#bae6fd', color: '#0369a1'}}>
          予約期間前です。<br/>
          予約は <strong>{formatTime(event.start_time)}</strong> からです。
        </div>
        <div className="explanation-text" style={{fontSize: '16px', lineHeight: '1.6', marginTop: '20px', textAlign: 'left'}}>
          {event.explanation_text && <div style={{marginBottom: '15px', whiteSpace: 'pre-wrap'}}>{event.explanation_text}</div>}
          <div style={{fontSize: '16px', color: 'var(--text-muted)', borderTop: '1px solid #eee', paddingTop: '10px'}}>
            <div><strong>開催日：</strong>{event.event_date.replace(/-/g, '/')}</div>
            {event.venue && <div><strong>開催場所：</strong>{event.venue}</div>}
          </div>
        </div>
      </div>
    )
  }

  if (currentTime > endTime || event.current_count >= event.capacity) {
    return (
      <div className="card">
        <h1 style={{color: 'var(--primary-blue)', fontSize: '28px', marginBottom: '15px'}}>{event.event_name}</h1>
        <div className="error-message">
          予約は終了しました。<br/>
          当日販売もありますので直接会場に来てください。
        </div>
        <div className="explanation-text" style={{fontSize: '16px', lineHeight: '1.6', marginTop: '20px', textAlign: 'left'}}>
          {event.explanation_text && <div style={{marginBottom: '15px', whiteSpace: 'pre-wrap'}}>{event.explanation_text}</div>}
          <div style={{fontSize: '16px', color: 'var(--text-muted)', borderTop: '1px solid #eee', paddingTop: '10px'}}>
            <div><strong>開催日：</strong>{event.event_date.replace(/-/g, '/')}</div>
            {event.venue && <div><strong>開催場所：</strong>{event.venue}</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h1 style={{color: 'var(--primary-blue)', fontSize: '28px', marginBottom: '15px'}}>{event.event_name}</h1>
      
      <div className="explanation-text" style={{fontSize: '16px', lineHeight: '1.6'}}>
        {event.explanation_text && <div style={{marginBottom: '15px', whiteSpace: 'pre-wrap'}}>{event.explanation_text}</div>}
        <div style={{fontSize: '16px', color: 'var(--text-muted)', borderTop: '1px solid #eee', paddingTop: '10px'}}>
          <div><strong>開催日：</strong>{event.event_date.replace(/-/g, '/')}</div>
          {event.venue && <div><strong>開催場所：</strong>{event.venue}</div>}
          <div style={{marginTop: '10px'}}><strong>受付開始日時：</strong>{formatTime(event.start_time)}</div>
          <div><strong>受付終了日時：</strong>{formatTime(event.end_time)}</div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>所属</label>
          <select value={className} onChange={(e) => setClassName(e.target.value)} required>
            {event.classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>名前（フルネーム）</label>
          <input 
            type="text" 
            value={childName} 
            onChange={(e) => setChildName(e.target.value)} 
            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            required 
          />
        </div>
        <button type="submit" className="btn-block" disabled={isSubmitting || !childName.trim()}>
          {isSubmitting ? '予約中...' : '予約する'}
        </button>
      </form>
    </div>
  )
}
