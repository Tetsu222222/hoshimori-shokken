import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ReservationForm from './ReservationForm'
import Admin from './Admin'
import Home from './Home'
import AdminList from './AdminList'
import AdminUrls from './AdminUrls'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/urls" element={<AdminUrls />} />
        <Route path="/:slug/list" element={<AdminList />} />
        <Route path="/:slug" element={<ReservationForm />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
