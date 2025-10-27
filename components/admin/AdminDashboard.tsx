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
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
  }

  return (
    <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-900">Bảng điều khiển quản trị</h2>
        <div className="flex flex-col md:flex-row gap-8 items-start">
            <aside className="w-full md:w-64 flex-shrink-0">
                <div className="bg-white p-4 rounded-xl shadow-xl space-y-2 border border-gray-200">
                    <NavButton view="results" label="Kết quả thi" icon={<ClipboardListIcon />} />
                    <NavButton view="analytics" label="Phân tích bài thi" icon={<ChartBarIcon />} />
                    <NavButton view="scheduling" label="Lên lịch thi" icon={<CalendarIcon />} />
                    <NavButton view="exams" label="Quản lý bài thi" icon={<DocumentTextIcon />} />
                    <NavButton view="questions" label="Ngân hàng câu hỏi" icon={<CollectionIcon />} />
                    <NavButton view="students" label="Quản lý học viên" icon={<UsersIcon />} />
                </div>
            </aside>
            <div className="flex-grow w-full">
                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-xl border border-gray-200 min-h-[400px]">
                    {renderActiveView()}
                </div>
            </div>
        </div>
    </div>
  );
};

export default AdminDashboard;