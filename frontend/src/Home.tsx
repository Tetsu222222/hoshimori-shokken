import { useEffect, useState } from 'react'

export default function Home() {
  const [cafeteriaName, setCafeteriaName] = useState('星の杜食堂')

  useEffect(() => {
    fetch('https://backend.s-yuuui.workers.dev/api/settings')
      .then(res => res.json())
      .then(data => setCafeteriaName(data.cafeteria_name))
  }, [])

  return (
    <div className="card" style={{textAlign: 'center', padding: '50px 20px'}}>
      <h1 style={{color: 'var(--primary-blue)', fontSize: '2.5rem', marginBottom: '10px'}}>{cafeteriaName}</h1>
      <h2 style={{color: 'var(--text-muted)', fontSize: '1.5rem', marginBottom: '40px', fontWeight: 'normal'}}>予約システム</h2>
      <p style={{fontSize: '1.1rem', lineHeight: '1.8', color: '#4b5563'}}>
        学校から配布された専用のURLからアクセスしてください。
      </p>
    </div>
  )
}
