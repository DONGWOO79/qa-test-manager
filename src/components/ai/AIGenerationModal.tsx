'use client';

import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, DocumentArrowUpIcon, SparklesIcon, PhotoIcon, TrashIcon, StopIcon } from '@heroicons/react/24/outline';

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onGenerationComplete: () => void;
}

export default function AIGenerationModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  onGenerationComplete
}: AIGenerationModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const supportedFormats = [
    '.pdf', '.docx', '.doc', '.pptx', '.ppt',
    '.xlsx', '.xls', '.csv', '.txt'
  ];

  const supportedImageFormats = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'
  ];

  // 브라우저 새로고침/종료 시 진행 중인 작업 중단
  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (currentTaskId && isGenerating) {
        console.log('🛑 브라우저 종료/새로고침 감지 - 작업 중단 요청:', currentTaskId);

        // AbortController로 진행 중인 요청 취소
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          console.log('🛑 AbortController로 요청 취소');
        }

        // 서버에 중단 요청 (keepalive로 브라우저 종료 시에도 요청 보장)
        try {
          await fetch(`/api/ai/progress?taskId=${currentTaskId}`, {
            method: 'DELETE',
            keepalive: true
          });
          console.log('✅ 브라우저 종료 시 작업 중단 요청 완료');
        } catch (error) {
          console.log('❌ 브라우저 종료 시 작업 중단 요청 실패:', error);
        }

        // 브라우저에 확인 메시지 표시 (선택사항)
        event.preventDefault();
        event.returnValue = 'AI 분석이 진행 중입니다. 페이지를 떠나면 작업이 중단됩니다.';
        return event.returnValue;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && currentTaskId && isGenerating) {
        console.log('🛑 페이지 숨김 감지 - 작업 중단 고려');
        // 페이지가 숨겨졌을 때는 즉시 중단하지 않고 로그만 남김
        // 필요시 여기서 중단 로직 추가 가능
      }
    };

    if (isGenerating && currentTaskId) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentTaskId, isGenerating]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError(null);
      setUploadedFile(file);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newImageFiles = Array.from(files);
      setImageFiles(prev => [...prev, ...newImageFiles]);
      setError(null);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      setError(null);
      setUploadedFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleCancel = async () => {
    try {
      // AbortController로 진행 중인 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        console.log('🛑 AbortController로 요청 취소');
      }

      // taskId가 있으면 서버에 중단 요청
      if (currentTaskId) {
        console.log('🛑 AI 분석 중단 요청:', currentTaskId);
        const response = await fetch(`/api/ai/progress?taskId=${currentTaskId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ 중단 성공:', result.message);
          setError('분석이 중단되었습니다.');
        } else {
          console.log('❌ 중단 실패:', response.status);
          setError('중단 요청에 실패했습니다.');
        }
      } else {
        // taskId가 없어도 로컬 상태는 중단
        console.log('🛑 로컬 상태 중단 (taskId 없음)');
        setError('분석이 중단되었습니다.');
      }
    } catch (err) {
      console.log('❌ 중단 요청 에러:', err);
      setError('중단 요청 중 오류가 발생했습니다.');
    } finally {
      // 항상 상태 초기화
      setIsGenerating(false);
      setProgress(0);
      setCurrentTaskId(null);
      abortControllerRef.current = null;
    }
  };

  const handleGenerate = async () => {
    if (!uploadedFile) {
      setError('파일을 선택해주세요.');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);

    // AbortController 생성
    abortControllerRef.current = new AbortController();
    let progressInterval: NodeJS.Timeout | null = null;
    let taskId: string | null = null;

    try {
      // 파일 업로드
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('projectId', projectId);
      formData.append('projectName', projectName);

      // 이미지 파일들 추가
      imageFiles.forEach((imageFile) => {
        formData.append('images', imageFile);
      });

      console.log('🚀 AI 분석 시작 - AbortController 연결됨');

      // 비동기로 API 호출 시작 (AbortController 연결)
      const responsePromise = fetch('/api/ai/generate-testcases', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal
      });

      const response = await responsePromise;

      if (!response.ok) {
        throw new Error('AI 생성 중 오류가 발생했습니다.');
      }

      // 먼저 응답을 받아서 taskId 추출
      const result = await response.json();
      console.log('🔍 API 응답 받음:', { success: result.success, taskId: result.taskId, generatedCount: result.generatedCount });

      // taskId가 있으면 즉시 진행률 폴링 시작
      if (result.taskId) {
        taskId = result.taskId;
        setCurrentTaskId(taskId); // 상태에 저장
        console.log('🔄 진행률 폴링 시작:', taskId);

        // 즉시 한 번 진행률 체크
        try {
          const initialProgressResponse = await fetch(`/api/ai/progress?taskId=${taskId}`);
          if (initialProgressResponse.ok) {
            const initialProgressData = await initialProgressResponse.json();
            if (initialProgressData.success) {
              console.log('📊 초기 진행률:', initialProgressData.data.progress + '%', initialProgressData.data.message);
              setProgress(initialProgressData.data.progress);
              
              // 초기 조회에서 100% 완료 상태인 경우 즉시 완료 처리
              if (initialProgressData.data.progress >= 100 || initialProgressData.data.isComplete) {
                console.log('✅ 초기 조회에서 작업 완료 감지 (100%)');
                setProgress(100);
                setIsGenerating(false);
                onGenerationComplete();
                
                // 0개 테스트케이스 생성 시 특별 메시지
                if (initialProgressData.data.result && initialProgressData.data.result.generatedCount === 0) {
                  alert('메타데이터 전용 문서로 판단되어 테스트케이스를 생성하지 않았습니다.\n실제 기능이나 화면 명세가 포함된 문서를 업로드해주세요.');
                } else {
                  alert('테스트케이스 생성이 완료되었습니다.');
                }
                onClose();
                return; // 폴링 시작하지 않고 종료
              }
            }
          } else if (initialProgressResponse.status === 404) {
            // 초기 조회에서 404 = 이미 완료된 작업
            console.log('✅ 초기 조회에서 작업 완료 감지 (404)');
            setProgress(100);
            setIsGenerating(false);
            onGenerationComplete();
            alert('테스트케이스 생성이 완료되었습니다.');
            onClose();
            return; // 폴링 시작하지 않고 종료
          }
        } catch (initialError) {
          console.log('⚠️ 초기 진행률 조회 실패:', initialError);
        }

        // 1초마다 진행률 폴링 (완료 플래그 사용)
        let isPollingComplete = false;
        progressInterval = setInterval(async () => {
          // 이미 완료된 경우 폴링 중단
          if (isPollingComplete) {
            if (progressInterval) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
            return;
          }

          try {
            const progressResponse = await fetch(`/api/ai/progress?taskId=${taskId}`);
            console.log('🌐 Progress API 응답 상태:', progressResponse.status);
            if (progressResponse.ok) {
              const progressData = await progressResponse.json();
              if (progressData.success) {
                const progressInfo = progressData.data;
                console.log('📊 진행률 업데이트:', progressInfo.progress + '%', progressInfo.message);
                setProgress(progressInfo.progress);

                // 완료되면 폴링 중지하고 결과 처리
                if (progressInfo.isComplete) {
                  console.log('✅ 진행률 폴링 완료');
                  isPollingComplete = true;
                  if (progressInterval) {
                    clearInterval(progressInterval);
                    progressInterval = null;
                  }

                  // 완료 후 결과 처리
                  if (progressInfo.result && progressInfo.result.success) {
                    setIsGenerating(false);
                    onGenerationComplete();
                    
                    // 0개 테스트케이스 생성 시 특별 메시지
                    const generatedCount = progressInfo.result.generatedCount || result.generatedCount || 0;
                    if (generatedCount === 0) {
                      alert('메타데이터 전용 문서로 판단되어 테스트케이스를 생성하지 않았습니다.\n실제 기능이나 화면 명세가 포함된 문서를 업로드해주세요.');
                    } else {
                      alert(`${generatedCount}개의 테스트케이스가 생성되었습니다.`);
                    }
                    onClose();
                  }
                }
              } else {
                console.log('❌ 진행률 조회 실패:', progressData.error);
              }
            } else if (progressResponse.status === 404) {
              // 404 에러는 작업이 완료되어 정리된 것으로 간주
              console.log('✅ 작업 완료로 간주 (404 - 진행률 정보 정리됨)');
              console.log('🔄 완료 처리 시작...');

              isPollingComplete = true;
              if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
                console.log('⏹️ 진행률 폴링 중단됨');
              }

              // 완료 처리
              console.log('📊 진행률을 100%로 설정');
              setProgress(100);
              console.log('🔄 생성 상태를 false로 변경');
              setIsGenerating(false);
              console.log('✅ onGenerationComplete 호출');
              onGenerationComplete();
              console.log('🎉 완료 팝업 표시');
              // 404 에러인 경우 결과를 알 수 없으므로 일반 메시지 표시
              alert('테스트케이스 생성이 완료되었습니다.');
              console.log('❌ 모달 닫기');
              onClose();
            } else {
              console.log('❌ 진행률 API 응답 실패:', progressResponse.status);
              console.log('🔍 404인지 확인:', progressResponse.status === 404);
            }
          } catch (progressError) {
            console.log('❌ 진행률 조회 에러:', progressError);
          }
        }, 1000);
      } else {
        console.log('⚠️ taskId가 없어 진행률 폴링을 시작할 수 없습니다.');

        // taskId가 없으면 기존 방식으로 처리
        if (result.success) {
          setProgress(100);
          onGenerationComplete();
          onClose();
          alert(`${result.generatedCount}개의 테스트케이스가 생성되었습니다.`);
        } else {
          throw new Error(result.error || '테스트케이스 생성에 실패했습니다.');
        }
      }
    } catch (err) {
      // AbortError는 사용자가 의도적으로 중단한 것이므로 별도 처리
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('✅ 사용자가 분석을 중단했습니다');
        setError('분석이 중단되었습니다.');
      } else {
        console.log('❌ AI 분석 에러:', err);
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      // 폴링 중지
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setIsGenerating(false);
      setProgress(0);
      setCurrentTaskId(null);
      abortControllerRef.current = null;
    }
  };

  const resetForm = () => {
    setUploadedFile(null);
    setImageFiles([]);
    setError(null);
    setProgress(0);
    setCurrentTaskId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <SparklesIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              AI 테스트케이스 생성
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Project Info */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">프로젝트 정보</h3>
            <p className="text-blue-800">{projectName}</p>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              기획서 업로드
            </h3>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${uploadedFile
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 hover:border-blue-400'
                }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />

              {uploadedFile ? (
                <div>
                  <p className="text-green-700 font-medium mb-2">
                    파일이 선택되었습니다
                  </p>
                  <p className="text-green-600 text-sm">{uploadedFile.name}</p>
                  <button
                    onClick={() => setUploadedFile(null)}
                    className="mt-2 text-sm text-red-600 hover:text-red-800"
                  >
                    다른 파일 선택
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 mb-2">
                    파일을 드래그하여 업로드하거나 클릭하여 선택하세요
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    파일 선택
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={supportedFormats.join(',')}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Supported Formats */}
            <div className="mt-3 text-sm text-gray-500">
              <p>지원 형식: {supportedFormats.join(', ')}</p>
              <p>파일 크기 제한: 최대 5MB</p>
            </div>

            {/* PDF 이미지 처리 안내 */}
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <SparklesIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-800">
                  <p className="font-medium mb-1">💡 이미지 PDF도 처리 가능!</p>
                  <p>스캔된 PDF나 이미지로만 구성된 PDF도 자동으로 Vision AI가 분석하여 테스트케이스를 생성합니다.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Image Upload Section */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <PhotoIcon className="h-5 w-5 mr-2 text-blue-600" />
              다이어그램/차트 이미지 (선택사항)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              플로우차트, 시스템 구조도, UI 목업 등의 이미지를 추가하면 더 정확한 테스트케이스를 생성할 수 있습니다.
            </p>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">
                  업로드된 이미지: {imageFiles.length}개
                </span>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="bg-blue-50 text-blue-600 px-3 py-1 rounded text-sm hover:bg-blue-100 flex items-center space-x-1"
                >
                  <PhotoIcon className="h-4 w-4" />
                  <span>이미지 추가</span>
                </button>
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept={supportedImageFormats.join(',')}
                onChange={handleImageSelect}
                multiple
                className="hidden"
              />

              {/* Image Preview */}
              {imageFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {imageFiles.map((file, index) => (
                    <div key={index} className="relative bg-gray-50 rounded-lg p-3 border">
                      <div className="flex items-center space-x-2">
                        <PhotoIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {Math.round(file.size / 1024)}KB
                          </p>
                        </div>
                        <button
                          onClick={() => removeImage(index)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {imageFiles.length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  아직 이미지가 업로드되지 않았습니다.
                </div>
              )}

              <div className="mt-3 text-xs text-gray-500">
                <p>지원 형식: {supportedImageFormats.join(', ')}</p>
                <p>여러 이미지를 동시에 선택할 수 있습니다.</p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Progress Bar */}
          {isGenerating && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {progress < 50
                    ? '📋 AI가 문서를 분석하고 명세서를 작성하고 있습니다...'
                    : progress === 50
                      ? '✅ 명세화 완료! 🚀 테스트케이스를 생성하고 있습니다...'
                      : '🧪 AI가 테스트케이스를 생성하고 있습니다...'
                  }
                </span>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 relative">
                {/* 50% 구분선 */}
                <div className="absolute left-1/2 top-0 w-px h-2 bg-gray-400 z-10"></div>
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${progress < 50
                    ? 'bg-blue-600'
                    : progress === 50
                      ? 'bg-green-500'
                      : 'bg-purple-600'
                    }`}
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              {/* 단계 표시 */}
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span className={progress >= 0 ? 'font-medium' : ''}>
                  📋 명세화 단계
                </span>
                <span className={progress >= 50 ? 'font-medium text-purple-600' : ''}>
                  🧪 테스트케이스 생성
                </span>
              </div>
              {/* Cancel Button - isGenerating일 때 항상 표시 */}
              <div className="flex justify-center mt-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2 text-sm"
                >
                  <StopIcon className="h-4 w-4" />
                  <span>분석 중단</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleClose}
              disabled={isGenerating}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleGenerate}
              disabled={!uploadedFile || isGenerating}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>생성 중...</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4" />
                  <span>테스트케이스 생성</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
