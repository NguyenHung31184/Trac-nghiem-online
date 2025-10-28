
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Class } from '../../types';
import { getAdminDashboardData } from '../../services/examService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { TrashIcon } from '../icons/TrashIcon';
import ClassFormModal from './ClassFormModal';
import Pagination from './Pagination';
import ConfirmationModal from './ConfirmationModal';
import StudentImporter from './StudentImporter'; // Import the new component

const ITEMS_PER_PAGE = 10;

const StudentManager: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination state
  const [currentStudentPage, setCurrentStudentPage] = useState(1);
  const [currentClassPage, setCurrentClassPage] = useState(1);

  // New state for class management modal
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getAdminDashboardData();
      setStudents(data.students);
      setClasses(data.classes);
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err);
      setError('Không thể tải dữ liệu. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pagination logic for students
  const totalStudentPages = Math.ceil(students.length / ITEMS_PER_PAGE);
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentStudentPage - 1) * ITEMS_PER_PAGE;
    return students.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [students, currentStudentPage]);

  // Pagination logic for classes
  const totalClassPages = Math.ceil(classes.length / ITEMS_PER_PAGE);
  const paginatedClasses = useMemo(() => {
    const startIndex = (currentClassPage - 1) * ITEMS_PER_PAGE;
    return classes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [classes, currentClassPage]);


  // Handler functions for class management
  const handleAddNewClass = () => {
    setEditingClass(null);
    setIsClassModalOpen(true);
  };

  const handleEditClass = (cls: Class) => {
    setEditingClass(cls);
    setIsClassModalOpen(true);
  };

  const handleDeleteClass = (classId: string) => {
    setConfirmTitle('Xác nhận xóa lớp học');
    setConfirmMessage('Bạn có chắc chắn muốn xóa lớp học này không?');
    setConfirmAction(() => async () => {
      try {
        // await deleteClass(classId);
        alert("Chức năng xóa tạm thời bị vô hiệu hóa trong bản demo này.");
        // fetchData(); // Refresh list
      } catch (error: any) {
        console.error('Failed to delete class:', error);
        alert(`Không thể xóa lớp học: ${error.message}`);
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleModalClose = () => {
    setIsClassModalOpen(false);
    setEditingClass(null);
  };

  const handleModalSave = () => {
    handleModalClose();
    fetchData(); // Refresh data after save
  };

  const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
        <p className="ml-4 text-gray-600">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg">{error}</div>;
  }

  return (
    <div className="space-y-12">
      {isClassModalOpen && (
        <ClassFormModal
          isOpen={isClassModalOpen}
          onClose={handleModalClose}
          onSave={handleModalSave}
          initialClass={editingClass}
        />
      )}
      
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmAction!}
        title={confirmTitle}
        message={<p>{confirmMessage}</p>}
      />

      {/* Student List Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Quản lý học viên</h3>
          <button className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-2 px-4 rounded-lg text-sm">Xuất CSV</button>
        </div>
        
        {/* Add the new StudentImporter component here */}
        <StudentImporter />
        
        <div className="mt-8"> {/* Add margin top for spacing */}
            <h4 className="text-xl font-bold text-gray-800 mb-4">Danh sách học viên hiện tại</h4>
            {/* Desktop Table View */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 hidden md:block">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ và tên</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lớp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{student.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {(student.classIds && student.classIds.length > 0)
                            ? student.classIds.map(id => classMap.get(id) || id).join(', ') 
                            : 'N/A'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Card View */}
            <div className="space-y-3 md:hidden">
                {paginatedStudents.map((student) => (
                    <div key={student.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                        <p className="font-bold text-gray-900 truncate">{student.name}</p>
                        <div className="mt-2 pt-2 border-t text-sm space-y-1">
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-gray-500 col-span-1">Email:</span>
                            <span className="text-gray-800 col-span-2 truncate">{student.email}</span>
                            <span className="text-gray-500 col-span-1">Lớp:</span>
                            <span className="text-gray-800 font-medium col-span-2">
                               {(student.classIds && student.classIds.length > 0)
                                    ? student.classIds.map(id => classMap.get(id) || id).join(', ') 
                                    : 'N/A'
                               }
                            </span>
                          </div>
                        </div>
                    </div>
                ))}
            </div>

            <Pagination
              currentPage={currentStudentPage}
              totalPages={totalStudentPages}
              onPageChange={setCurrentStudentPage}
            />
        </div>
      </div>


      {/* Class List Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-2xl font-bold text-gray-900">Quản lý lớp học</h3>
            <button
              onClick={handleAddNewClass}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
            >
              <PlusCircleIcon />
              <span className="ml-2">Thêm lớp học mới</span>
            </button>
        </div>
        
        {/* Desktop Table View */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 hidden md:block">
            <table className="min-w-full bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên lớp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedClasses.map((cls) => (
                    <tr key={cls.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cls.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 space-x-2">
                          <button onClick={() => handleEditClass(cls)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-full transition-colors" title="Sửa lớp học"><PencilIcon/></button>
                          <button onClick={() => handleDeleteClass(cls.id)} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-gray-100 rounded-full transition-colors" title="Xóa lớp học"><TrashIcon/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </table>
        </div>

        {/* Mobile Card View */}
        <div className="space-y-3 md:hidden">
            {paginatedClasses.map((cls) => (
                <div key={cls.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 flex justify-between items-center">
                    <p className="font-bold text-gray-900">{cls.name}</p>
                    <div className="space-x-2 flex-shrink-0">
                         <button onClick={() => handleEditClass(cls)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-full transition-colors" title="Sửa lớp học"><PencilIcon/></button>
                         <button onClick={() => handleDeleteClass(cls.id)} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-gray-100 rounded-full transition-colors" title="Xóa lớp học"><TrashIcon/></button>
                    </div>
                </div>
            ))}
        </div>

         <Pagination
          currentPage={currentClassPage}
          totalPages={totalClassPages}
          onPageChange={setCurrentClassPage}
        />
      </div>
    </div>
  );
};

export default StudentManager;
