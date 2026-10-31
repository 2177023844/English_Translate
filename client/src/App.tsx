import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import QuoteCard from './components/QuoteCard'
import Dashboard from './pages/Dashboard'
import Papers from './pages/Papers'
import PaperModule from './pages/PaperModule'
import PaperSession from './pages/PaperSession'
import Favorites from './pages/Favorites'
import Review from './pages/Review'
import SettingsPage from './pages/SettingsPage'
import Spell from './pages/Spell'
import Stats from './pages/Stats'
import Study from './pages/Study'
import StudyList from './pages/StudyList'
import Translate from './pages/Translate'
import TranslateDetail from './pages/TranslateDetail'

export default function App() {
  const { pathname } = useLocation()
  // 试卷做题页占满整个视口，其余页面保持居中的阅读宽度
  const wide = pathname.startsWith('/papers/sets/')

  return (
    <div
      className={`bg-slate-50 text-slate-900 ${
        wide ? 'flex h-screen flex-col overflow-hidden' : 'min-h-screen'
      }`}
    >
      <NavBar />
      <main
        className={
          wide
            ? 'flex min-h-0 w-full flex-1 flex-col px-3 py-3'
            : 'mx-auto w-full max-w-[max(70vw,1024px)] px-4 pb-16 pt-6'
        }
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/study" element={<StudyList />} />
          <Route path="/study/:bookId" element={<Study />} />
          <Route path="/review" element={<Review />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/spell" element={<Spell />} />
          <Route path="/translate" element={<Translate />} />
          <Route path="/translate/:wordId" element={<TranslateDetail />} />
          <Route path="/papers" element={<Papers />} />
          <Route path="/papers/:level" element={<Papers />} />
          <Route path="/papers/sets/:setId/:moduleId" element={<PaperModule />} />
          <Route path="/papers/:level/:year/:session" element={<PaperSession />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!wide && <QuoteCard />}
    </div>
  )
}
