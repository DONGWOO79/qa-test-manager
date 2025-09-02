import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import db from '@/lib/db/database';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: '프로젝트 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 확장자 검증
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { success: false, error: '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    // 파일을 ArrayBuffer로 읽기
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { success: false, error: '엑셀 파일에 시트가 없습니다.' },
        { status: 400 }
      );
    }

    console.log('=== Excel 파일 분석 시작 ===');
    console.log('파일명:', file.name);
    console.log('시트 목록:', workbook.SheetNames);
    console.log('시트 개수:', workbook.SheetNames.length);

    // 임시로 기본 사용자 ID 사용 (개발용)
    const userId = 1;
    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    const allErrors: string[] = [];
    const sheetResults: any[] = [];

    // 모든 시트 처리
    for (const sheetName of workbook.SheetNames) {
      console.log(`\n=== 시트 "${sheetName}" 처리 시작 ===`);
      
      const worksheet = workbook.Sheets[sheetName];
      let sheetSuccessCount = 0;
      let sheetErrorCount = 0;
      
      // 방법 1: 원시 데이터로 읽기
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      console.log(`시트 "${sheetName}" 범위:`, range);
      
      // 헤더를 찾기 위해 여러 방법 시도
      let headers: string[] = [];
      let dataStartRow = 0;
      
      // 첫 번째 행이 헤더인지 확인
      const firstRow = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        const cell = worksheet[cellAddress];
        firstRow.push(cell ? cell.v : '');
      }
      
      console.log(`시트 "${sheetName}" 첫 번째 행:`, firstRow);
      
      // 첫 번째 행에 "TC ID"가 있으면 헤더로 인식
      if (firstRow.includes('TC ID') || firstRow.includes('No') || firstRow.includes('번호')) {
        headers = firstRow;
        dataStartRow = 1;
        console.log(`시트 "${sheetName}": 첫 번째 행을 헤더로 인식`);
      } else {
        // 두 번째 행을 헤더로 시도
        const secondRow = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: 1, c: col });
          const cell = worksheet[cellAddress];
          secondRow.push(cell ? cell.v : '');
        }
        console.log(`시트 "${sheetName}" 두 번째 행:`, secondRow);
        
        if (secondRow.includes('TC ID') || secondRow.includes('No') || secondRow.includes('번호')) {
          headers = secondRow;
          dataStartRow = 2;
          console.log(`시트 "${sheetName}": 두 번째 행을 헤더로 인식`);
        } else {
          // 세 번째 행을 헤더로 시도
          const thirdRow = [];
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 2, c: col });
            const cell = worksheet[cellAddress];
            thirdRow.push(cell ? cell.v : '');
          }
          console.log(`시트 "${sheetName}" 세 번째 행:`, thirdRow);
          
          if (thirdRow.includes('TC ID') || thirdRow.includes('No') || thirdRow.includes('번호')) {
            headers = thirdRow;
            dataStartRow = 3;
            console.log(`시트 "${sheetName}": 세 번째 행을 헤더로 인식`);
          } else {
            allErrors.push(`시트 "${sheetName}": 헤더를 찾을 수 없습니다.`);
            continue;
          }
        }
      }
      
      console.log(`시트 "${sheetName}" 최종 헤더:`, headers);
      console.log(`시트 "${sheetName}" 데이터 시작 행:`, dataStartRow);

      // 트랜잭션으로 데이터 import
      const transaction = db.transaction(() => {
        for (let rowIndex = dataStartRow; rowIndex <= range.e.r; rowIndex++) {
          try {
            // 행 데이터 읽기
            const rowData: any = {};
            headers.forEach((header, colIndex) => {
              const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
              const cell = worksheet[cellAddress];
              rowData[header] = cell ? cell.v : '';
            });

            // 빈 행 체크 - 모든 필드가 비어있으면 건너뛰기
            const hasData = Object.values(rowData).some(value => 
              value !== null && value !== undefined && value !== ''
            );
            
            if (!hasData) {
              console.log(`시트 "${sheetName}" 행 ${rowIndex + 1}: 빈 행이므로 건너뜀`);
              continue;
            }

            console.log(`시트 "${sheetName}" 행 ${rowIndex + 1} 데이터:`, rowData);

            // 필드 매핑
            const title = rowData['TC ID'] || rowData['No'] || rowData['번호'] || '';
            const category1 = rowData['분류기준 1'] || '';
            const category2 = rowData['분류기준 2'] || '';
            const category3 = rowData['분류기준 3'] || '';
            const testObjective = rowData['테스트 목표'] || '';
            const preCondition = rowData['사전 조건 (Pre Condition)'] || '';
            const testStep = rowData['확인 방법 (Test Step)'] || '';
            const expectedResult = rowData['기대 결과 (Expected Result)'] || '';
            const testResult = rowData['결과 (Test Result)'] || '';
            const tester = rowData['Tester'] || '';
            const comment = rowData['코멘트'] || '';
            const btsLink = rowData['BTS 링크'] || '';

            // 필수 필드 검증
            if (!title) {
              allErrors.push(`시트 "${sheetName}" 행 ${rowIndex + 1}: TC ID가 필요합니다. (빈 행일 수 있음)`);
              sheetErrorCount++;
              totalErrorCount++;
              continue;
            }

            // 카테고리 생성 - 시트명 포함
            let categoryName = `[${sheetName}] `;
            if (category1) categoryName += category1;
            else categoryName += '기타';
            
            if (category2) categoryName += ` > ${category2}`;
            if (category3) categoryName += ` > ${category3}`;

            console.log(`시트 "${sheetName}" 행 ${rowIndex + 1}: 카테고리명 = "${categoryName}"`);

            // 카테고리 찾기 또는 생성
            let categoryId = db.prepare(`
              SELECT id FROM test_categories 
              WHERE name = ? AND project_id = ?
            `).get(categoryName, projectId);

            if (!categoryId) {
              const result = db.prepare(`
                INSERT INTO test_categories (name, project_id)
                VALUES (?, ?)
              `).run(categoryName, projectId);
              categoryId = { id: result.lastInsertRowid };
              console.log(`시트 "${sheetName}": 새 카테고리 생성 - "${categoryName}" (ID: ${categoryId.id})`);
            } else {
              console.log(`시트 "${sheetName}": 기존 카테고리 사용 - "${categoryName}" (ID: ${categoryId.id})`);
            }

            // 테스트 케이스 생성
            const description = `${testObjective}\n\n사전 조건:\n${preCondition}\n\n확인 방법:\n${testStep}\n\n기대 결과:\n${expectedResult}`;
            
            const testCaseResult = db.prepare(`
              INSERT INTO test_cases (
                title, description, category_id, project_id, priority, 
                expected_result, status, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              title,
              description,
              categoryId.id,
              projectId,
              'medium', // 기본값
              expectedResult,
              testResult === 'Pass' ? 'pass' : 
              testResult === 'Fail' ? 'fail' : 
              testResult === 'N/A' ? 'na' : 'not_run',
              userId
            );

            const testCaseId = testCaseResult.lastInsertRowid;

            // 테스트 스텝 처리
            if (testStep) {
              const steps = testStep.split('\n').filter(step => step.trim());
              for (let j = 0; j < steps.length; j++) {
                const step = steps[j].trim();
                if (step) {
                  db.prepare(`
                    INSERT INTO test_steps (
                      test_case_id, step_number, action, expected_result
                    ) VALUES (?, ?, ?, ?)
                  `).run(testCaseId, j + 1, step, expectedResult);
                }
              }
            }

            sheetSuccessCount++;
            totalSuccessCount++;
            console.log(`시트 "${sheetName}" 행 ${rowIndex + 1} 성공적으로 처리됨`);
          } catch (error) {
            console.error(`시트 "${sheetName}" 행 ${rowIndex + 1} Import error:`, error);
            allErrors.push(`시트 "${sheetName}" 행 ${rowIndex + 1}: ${error}`);
            sheetErrorCount++;
            totalErrorCount++;
          }
        }
      });

      transaction();
      
      sheetResults.push({
        sheetName,
        successCount: sheetSuccessCount,
        errorCount: sheetErrorCount
      });
      
      console.log(`=== 시트 "${sheetName}" 처리 완료: ${sheetSuccessCount}개 성공, ${sheetErrorCount}개 실패 ===`);
    }

    console.log('=== Excel 파일 분석 완료 ===');
    console.log('전체 결과:', { totalSuccessCount, totalErrorCount, sheetResults });

    return NextResponse.json({
      success: true,
      message: `Import 완료: ${totalSuccessCount}개 성공, ${totalErrorCount}개 실패`,
      data: {
        successCount: totalSuccessCount,
        errorCount: totalErrorCount,
        errors: allErrors.slice(0, 20), // 최대 20개 에러만 반환
        processedSheets: workbook.SheetNames,
        sheetResults: sheetResults
      }
    });

  } catch (error) {
    console.error('Excel import error:', error);
    return NextResponse.json(
      { success: false, error: '엑셀 파일 import에 실패했습니다.' },
      { status: 500 }
    );
  }
}
