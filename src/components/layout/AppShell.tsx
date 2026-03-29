import { Outlet } from 'react-router-dom'
import BottomTabBar from './BottomTabBar'
import AddNewSheet from '../addNew/AddNewSheet'

export default function AppShell() {
  return (
    <div className="app-shell">
      <main>
        <Outlet />
      </main>
      <BottomTabBar />
      <AddNewSheet />
    </div>
  )
}
