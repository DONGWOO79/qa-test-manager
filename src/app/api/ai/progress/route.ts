import { NextRequest, NextResponse } from 'next/server';
import { progressStore } from '@/lib/progress-store';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');

        if (!taskId) {
            return NextResponse.json(
                { success: false, error: 'taskId 파라미터가 필요합니다.' },
                { status: 400 }
            );
        }

        const progress = progressStore.getProgress(taskId);

        if (!progress) {
            return NextResponse.json(
                { success: false, error: '해당 작업을 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: progress
        });

    } catch (error) {
        console.error('진행률 조회 실패:', error);
        return NextResponse.json(
            { success: false, error: '진행률 조회 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

// 디버깅용: 모든 진행률 정보 조회
export async function POST(request: NextRequest) {
    try {
        const allProgress = progressStore.getAllProgress();
        return NextResponse.json({
            success: true,
            data: allProgress,
            count: allProgress.length
        });
    } catch (error) {
        console.error('전체 진행률 조회 실패:', error);
        return NextResponse.json(
            { success: false, error: '전체 진행률 조회 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

// 작업 중단
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');

        if (taskId) {
            // 특정 작업 중단
            progressStore.cancelTask(taskId);
            return NextResponse.json({
                success: true,
                message: `작업 ${taskId}가 중단되었습니다.`
            });
        } else {
            // 모든 작업 중단
            progressStore.cancelAllTasks();
            return NextResponse.json({
                success: true,
                message: '모든 작업이 중단되었습니다.'
            });
        }
    } catch (error) {
        console.error('작업 중단 실패:', error);
        return NextResponse.json(
            { success: false, error: '작업 중단 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}
