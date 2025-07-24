'use client';

import { useState, useRef } from 'react';
import { 
  ArrowUpTrayIcon, 
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface ExcelImportExportProps {
  projectId: string;
  onImportComplete?: () => void;
}

export default function ExcelImportExport({ projectId, onImportComplete }: ExcelImportExportProps) {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', projectId);

      const response = await fetch('/api/import-export/import-excel', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setImportResult({
          type: 'success',
          message: result.message,
          data: result.data
        });
        onImportComplete?.();
      } else {
        setImportResult({
          type: 'error',
          message: result.error
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        type: 'error',
        message: '파일 업로드 중 오류가 발생했습니다.'
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (type: 'test-cases' | 'test-results') => {
    setExporting(true);

    try {
      const response = await fetch(
        `/api/import-export/export-excel?projectId=${projectId}&type=${type}`,
        { method: 'GET' }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qa-${type}-${projectId}-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert('내보내기 실패: ' + error.error);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('내보내기 중 오류가 발생했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        title: '로그인 테스트',
        description: '사용자 로그인 기능 테스트',
        category: '인증',
        priority: 'high',
        expected_result: '로그인 성공',
        steps: '1. 사용자명 입력; 2. 비밀번호 입력; 3. 로그인 버튼 클릭'
      },
      {
        title: '회원가입 테스트',
        description: '새 사용자 회원가입 기능 테스트',
        category: '인증',
        priority: 'medium',
        expected_result: '회원가입 완료',
        steps: '1. 회원가입 폼 작성; 2. 이메일 인증; 3. 가입 완료'
      }
    ];

    const workbook = new (window as any).XLSX.utils.book_new();
    const worksheet = new (window as any).XLSX.utils.json_to_sheet(templateData);
    new (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, '템플릿');
    
    const excelBuffer = new (window as any).XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx' 
    });
    
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qa-test-cases-template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">엑셀 Import/Export</h2>

      {/* Import 섹션 */}
      <div className="mb-8">
        <h3 className="text-md font-medium text-gray-900 mb-4">테스트 케이스 Import</h3>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
              {importing ? 'Import 중...' : '엑셀 파일 선택'}
            </button>
            
            <button
              onClick={downloadTemplate}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
              템플릿 다운로드
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="text-sm text-gray-600">
            <p>• 지원 형식: .xlsx, .xls</p>
            <p>• 필수 컬럼: title, category</p>
            <p>• 선택 컬럼: description, priority, expected_result, steps</p>
          </div>
        </div>

        {/* Import 결과 */}
        {importResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            importResult.type === 'success' 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center">
              {importResult.type === 'success' ? (
                <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
              )}
              <span className={`text-sm font-medium ${
                importResult.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {importResult.message}
              </span>
            </div>
            
            {importResult.data && (
              <div className="mt-2 text-sm text-gray-600">
                <p>성공: {importResult.data.successCount}개</p>
                <p>실패: {importResult.data.errorCount}개</p>
                {importResult.data.errors && importResult.data.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">에러 목록:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {importResult.data.errors.map((error: string, index: number) => (
                        <li key={index} className="text-xs">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export 섹션 */}
      <div>
        <h3 className="text-md font-medium text-gray-900 mb-4">데이터 Export</h3>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleExport('test-cases')}
              disabled={exporting}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              {exporting ? 'Export 중...' : '테스트 케이스 Export'}
            </button>
            
            <button
              onClick={() => handleExport('test-results')}
              disabled={exporting}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              {exporting ? 'Export 중...' : '테스트 결과 Export'}
            </button>
          </div>

          <div className="text-sm text-gray-600">
            <p>• 테스트 케이스 Export: 모든 테스트 케이스와 스텝 정보</p>
            <p>• 테스트 결과 Export: 실행 결과와 통계 정보</p>
            <p>• 파일 형식: .xlsx (Excel)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
