'use client';

import { useState, useRef } from 'react';
import { XMarkIcon, DocumentArrowUpIcon, SparklesIcon, PhotoIcon, TrashIcon } from '@heroicons/react/24/outline';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const supportedFormats = [
    '.pdf', '.docx', '.doc', '.pptx', '.ppt',
    '.xlsx', '.xls', '.csv', '.txt'
  ];

  const supportedImageFormats = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'
  ];

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

  const handleGenerate = async () => {
    if (!uploadedFile) {
      setError('파일을 선택해주세요.');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);

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

      const response = await fetch('/api/ai/generate-testcases', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('AI 생성 중 오류가 발생했습니다.');
      }

      const result = await response.json();

      if (result.success) {
        onGenerationComplete();
        onClose();
        // 성공 메시지 표시
        alert(`${result.generatedCount}개의 테스트케이스가 생성되었습니다.`);
      } else {
        throw new Error(result.error || '테스트케이스 생성에 실패했습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const resetForm = () => {
    setUploadedFile(null);
    setImageFiles([]);
    setError(null);
    setProgress(0);
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
                  AI가 테스트케이스를 생성하고 있습니다...
                </span>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
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
