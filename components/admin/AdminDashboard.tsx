import React, { useState } from 'react';
import type { User } from '../../types';
import StudentManager from './StudentManager';
import ResultsManager from './ResultsManager';
import QuestionBankManager from './QuestionBankManager';
import ExamManager from './ExamManager';
import SchedulingManager from './SchedulingManager';
import AnalyticsDashboard from './AnalyticsDashboard';
import { UsersIcon } from '../icons/UsersIcon';
import { ClipboardListIcon } from '../icons/ClipboardListIcon';
import { CollectionIcon } from '../icons/CollectionIcon';
import { DocumentTextIcon } from '../icons/DocumentTextIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { ChartBarIcon } from '../icons/ChartBarIcon';

interface AdminDashboardProps {
  onViewProctoringReport: (attemptId: string) => void;
}

type AdminView = 'results' | 'questions' | 'students' | 'exams' | 'scheduling' | 'analytics';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewProctoringReport }) => {
  const [activeView, setActiveView] = useState<AdminView>('analytics');

  const renderActiveView = () => {
    switch (activeView) {
      case 'students':
        return <StudentManager />;
      case 'results':
        return <ResultsManager onViewProctoringReport={onViewProctoringReport} />;
      case 'questions':
        return <QuestionBankManager />;
      case 'exams':
        return <ExamManager />;
      case 'scheduling':
        return <SchedulingManager />;
      case 'analytics':
        return <AnalyticsDashboard />;
      default:
        return <ResultsManager onViewProctoringReport={onViewProctoringReport} />;
    }
  };
  
  const NavButton: React.FC<{view: AdminView, label: string, icon: React.ReactNode}> = ({view, label, icon}) => {
    const isActive = activeView === view;
    return (
      <button
        onClick={() => setActiveView(view)}
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-semibold transition-colors w-full text-left ${
          isActive 
            ? 'bg-gray-200 text-gray-900' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {icon}
        <span className="flex-grow">{label}</span>
        {isActive && (
          <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Bảng điều khiển quản trị</h1>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <aside className="lg:col-span-1">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-2">
            <NavButton view="analytics" label="Phân tích bài thi" icon={<ChartBarIcon className="w-5 h-5" />} />
            <NavButton view="results" label="Kết quả thi" icon={<ClipboardListIcon className="w-5 h-5" />} />
            <NavButton view="scheduling" label="Lên lịch thi" icon={<CalendarIcon className="w-5 h-5" />} />
            <NavButton view="exams" label="Quản lý bài thi" icon={<DocumentTextIcon className="w-5 h-5" />} />
            <NavButton view="questions" label="Ngân hàng câu hỏi" icon={<CollectionIcon className="w-5 h-5" />} />
            <NavButton view="students" label="Quản lý học viên" icon={<UsersIcon className="w-5 h-5" />} />
          </div>
        </aside>
        <main className="lg:col-span-3">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 min-h-[480px]">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
