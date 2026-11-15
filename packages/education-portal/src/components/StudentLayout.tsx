import { ReactNode } from 'react';
import { StudentSidebar } from './StudentSidebar';
import { StudentHeader } from './StudentHeader';

interface StudentLayoutProps {
  children: ReactNode;
  user?: any;
  onLogout?: () => void;
}

export function StudentLayout({ children, user, onLogout }: StudentLayoutProps) {
  return (
    <div className="student-layout">
      <StudentSidebar user={user} />
      <div className="student-main-content">
        <StudentHeader user={user} onLogout={onLogout} />
        <main style={{ flex: 1, padding: '2rem' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
