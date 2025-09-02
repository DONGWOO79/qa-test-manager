import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('Ollama 테스트 시작');
    
    const prompt = `
당신은 QA 테스트 엔지니어입니다. 다음 프로젝트 요구사항을 분석하여 테스트케이스를 생성하세요.

프로젝트명: 온라인 쇼핑몰

요구사항:
- 회원가입 기능
- 로그인/로그아웃 기능
- 상품 목록 조회
- 장바구니 추가/삭제

다음 JSON 형식으로 3개의 테스트케이스를 생성하세요:
[
  {
    "title": "테스트케이스 제목",
    "description": "테스트케이스 설명",
    "category": "카테고리",
    "priority": "High",
    "status": "Not Run",
    "preCondition": "사전조건",
    "testStep": "테스트 단계",
    "expectedResult": "예상 결과"
  }
]

JSON 배열만 반환하고 추가 텍스트는 포함하지 마세요.
`;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama2',
        prompt: prompt,
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API 오류: ${response.status}`);
    }

    const data = await response.json();
    console.log('Ollama 응답:', data);

    return NextResponse.json({
      success: true,
      response: data.response,
      model: data.model
    });

  } catch (error) {
    console.error('Ollama 테스트 오류:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
