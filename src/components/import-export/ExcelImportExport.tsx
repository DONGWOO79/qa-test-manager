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

  const handleExport = async (type: 'test-cases' | 'statistics') => {
    setExporting(true);

    try {
      const response = await fetch(
        `/api/import-export/export-excel?projectId=${projectId}&type=${type}`,
        { method: 'GET' }
      );

      if (response.ok) {
        const blob = await response.blob();
        
        // 파일명을 명시적으로 설정 (확장자 강제)
        const today = new Date().toISOString().split('T')[0];
        let filename = '';
        
        if (type === 'test-cases') {
          filename = `qa-test-cases-${projectId}-${today}.xlsx`;
        } else if (type === 'statistics') {
          filename = `qa-report-${projectId}-${today}.xlsx`;
        }
        
        console.log('Downloading file:', filename); // 디버깅용
        
        // Blob에 올바른 MIME 타입 설정
        const excelBlob = new Blob([blob], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const url = window.URL.createObjectURL(excelBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename; // 명시적으로 파일명 설정
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        
        // 정리
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
        
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
        'TC ID': 'TC001',
        '분류기준 1': '인증',
        '분류기준 2': '로그인',
        '분류기준 3': '일반',
        '테스트 목표': '사용자 로그인 기능 테스트',
        '사전 조건 (Pre Condition)': '유효한 계정이 존재함',
        '확인 방법 (Test Step)': '1. 사용자명 입력\n2. 비밀번호 입력\n3. 로그인 버튼 클릭',
        '기대 결과 (Expected Result)': '로그인 성공',
        '결과 (Test Result)': 'Pass',
        'Tester': '테스터1',
        '코멘트': '정상 동작',
        'BTS 링크': 'https://example.com/bts/123'
      },
      {
        'TC ID': 'TC002',
        '분류기준 1': '인증',
        '분류기준 2': '회원가입',
        '분류기준 3': '일반',
        '테스트 목표': '새 사용자 회원가입 기능 테스트',
        '사전 조건 (Pre Condition)': '회원가입 페이지 접근 가능',
        '확인 방법 (Test Step)': '1. 회원가입 폼 작성\n2. 이메일 인증\n3. 가입 완료',
        '기대 결과 (Expected Result)': '회원가입 완료',
        '결과 (Test Result)': 'Pass',
        'Tester': '테스터2',
        '코멘트': '정상 동작',
        'BTS 링크': 'https://example.com/bts/124'
      }
    ];

    const workbook = new (window as any).XLSX.utils.book_new();
    
    // 첫 번째 시트 (인증)
    const authWorksheet = new (window as any).XLSX.utils.json_to_sheet(templateData);
    new (window as any).XLSX.utils.book_append_sheet(workbook, authWorksheet, '인증');
    
    // 두 번째 시트 (회원관리)
    const memberData = [
      {
        'TC ID': 'TC003',
        '분류기준 1': '회원관리',
        '분류기준 2': '프로필',
        '분류기준 3': '수정',
        '테스트 목표': '사용자 프로필 수정 기능 테스트',
        '사전 조건 (Pre Condition)': '로그인된 상태',
        '확인 방법 (Test Step)': '1. 프로필 페이지 접근\n2. 정보 수정\n3. 저장 버튼 클릭',
        '기대 결과 (Expected Result)': '프로필 정보가 수정됨',
        '결과 (Test Result)': 'Pass',
        'Tester': '테스터3',
        '코멘트': '정상 동작',
        'BTS 링크': 'https://example.com/bts/125'
      }
    ];
    const memberWorksheet = new (window as any).XLSX.utils.json_to_sheet(memberData);
    new (window as any).XLSX.utils.book_append_sheet(workbook, memberWorksheet, '회원관리');
    
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
            <p>• <strong>시트 구분:</strong> 각 시트는 별도의 카테고리로 자동 분류됩니다</p>
            <p>• <strong>카테고리 형식:</strong> [시트명] 분류기준1 {'>'} 분류기준2 {'>'} 분류기준3</p>
            <p>• 필수 컬럼: TC ID, 분류기준 1, 테스트 목표</p>
            <p>• 선택 컬럼: 분류기준 2, 분류기준 3, 사전 조건, 확인 방법, 기대 결과, 결과, Tester, 코멘트, BTS 링크</p>
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
                
                {/* 처리된 시트 정보 */}
                {importResult.data.processedSheets && importResult.data.processedSheets.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">처리된 시트 ({importResult.data.processedSheets.length}개):</p>
                    <ul className="list-disc list-inside space-y-1">
                      {importResult.data.processedSheets.map((sheet: string, index: number) => (
                        <li key={index} className="text-xs">📄 {sheet}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* 시트별 결과 */}
                {importResult.data.sheetResults && importResult.data.sheetResults.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">시트별 결과:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {importResult.data.sheetResults.map((result: any, index: number) => (
                        <li key={index} className="text-xs">
                          📊 {result.sheetName}: {result.successCount}개 성공, {result.errorCount}개 실패
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* 에러 목록 */}
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
              onClick={() => handleExport('statistics')}
              disabled={exporting}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              {exporting ? 'Export 중...' : '통계 리포트 Export'}
            </button>
          </div>

          <div className="text-sm text-gray-600">
            <p>• 테스트 케이스 Export: 모든 테스트 케이스와 상세 정보</p>
            <p>• 통계 리포트 Export: 프로젝트별 통계 및 결과 요약</p>
            <p>• 파일 형식: .xlsx (Excel)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
