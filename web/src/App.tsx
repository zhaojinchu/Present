import { createBrowserRouter, RouterProvider } from 'react-router';
import AddFriend from './routes/AddFriend';
import { SignIn, SignUp } from './routes/auth';
import CircleDetail from './routes/CircleDetail';
import CircleJoin from './routes/CircleJoin';
import CircleNew from './routes/CircleNew';
import Circles from './routes/Circles';
import Comments from './routes/Comments';
import Dev from './routes/Dev';
import Explain from './routes/Explain';
import Feed from './routes/Feed';
import Friends from './routes/Friends';
import FriendsShare from './routes/FriendsShare';
import ScanQr from './routes/ScanQr';
import Post from './routes/Post';
import RootLayout from './routes/RootLayout';
import Schedule from './routes/Schedule';
import ScheduleEdit from './routes/ScheduleEdit';
import ScheduleImport from './routes/ScheduleImport';
import Settings from './routes/Settings';
import { NotFound } from './routes/stubs';
import Today from './routes/Today';
import UserProfile from './routes/UserProfile';
import You from './routes/You';

// Tab screens are the three at the top; everything else is a pushed screen over one of them.
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Feed /> },
      { path: 'today', element: <Today /> },
      { path: 'you', element: <You /> },
      { path: 'post/:occurrenceId', element: <Post /> },
      { path: 'comments/:eventId', element: <Comments /> },
      { path: 'explain/:missId', element: <Explain /> },
      { path: 'friends', element: <Friends /> },
      { path: 'friends/share', element: <FriendsShare /> },
      { path: 'friends/scan', element: <ScanQr /> },
      { path: 'circles', element: <Circles /> },
      { path: 'circles/new', element: <CircleNew /> },
      { path: 'circles/join', element: <CircleJoin /> },
      { path: 'circles/:circleId', element: <CircleDetail /> },
      { path: 'add/:username', element: <AddFriend /> },
      { path: 'u/:username', element: <UserProfile /> },
      { path: 'schedule', element: <Schedule /> },
      { path: 'schedule/edit/:classId?', element: <ScheduleEdit /> },
      { path: 'schedule/import', element: <ScheduleImport /> },
      { path: 'settings', element: <Settings /> },
      { path: 'dev', element: <Dev /> },
      { path: 'sign-in', element: <SignIn /> },
      { path: 'sign-up', element: <SignUp /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
