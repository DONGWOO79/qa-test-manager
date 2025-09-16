// 임시 메모리 저장소 - 진행률 정보 저장용
interface ProgressInfo {
    taskId: string;
    step: string;
    progress: number;
    message: string;
    timestamp: string;
    isComplete: boolean;
    error?: string;
    result?: any;
}

class ProgressStore {
    private store = new Map<string, ProgressInfo>();
    private readonly CLEANUP_INTERVAL = 10 * 60 * 1000; // 10분
    private readonly MAX_AGE = 20 * 60 * 1000; // 20분
    private readonly COMPLETED_TASK_KEEP_TIME = 5 * 60 * 1000; // 완료된 작업은 5분간 유지

    constructor() {
        // 주기적으로 오래된 진행률 정보 정리
        setInterval(() => {
            this.cleanup();
        }, this.CLEANUP_INTERVAL);
    }

    // 진행률 업데이트
    updateProgress(taskId: string, step: string, progress: number, message: string) {
        this.store.set(taskId, {
            taskId,
            step,
            progress,
            message,
            timestamp: new Date().toISOString(),
            isComplete: false
        });

        console.log(`📊 [${progress}%] ${step}: ${message} (Task: ${taskId})`);
    }

    // 완료 처리
    setComplete(taskId: string, result: any) {
        const existing = this.store.get(taskId);
        if (existing) {
            this.store.set(taskId, {
                ...existing,
                progress: 100,
                isComplete: true,
                result,
                timestamp: new Date().toISOString()
            });
        }
    }

    // 에러 처리
    setError(taskId: string, error: string) {
        const existing = this.store.get(taskId);
        if (existing) {
            this.store.set(taskId, {
                ...existing,
                isComplete: true,
                error,
                timestamp: new Date().toISOString()
            });
        }
    }

    // 진행률 조회
    getProgress(taskId: string): ProgressInfo | null {
        return this.store.get(taskId) || null;
    }

    // 오래된 데이터 정리
    private cleanup() {
        const now = Date.now();
        for (const [taskId, info] of this.store.entries()) {
            const age = now - new Date(info.timestamp).getTime();

            // 완료된 작업은 2분간 유지, 진행중인 작업은 10분간 유지
            const maxAge = info.isComplete ? this.COMPLETED_TASK_KEEP_TIME : this.MAX_AGE;

            if (age > maxAge) {
                this.store.delete(taskId);
                console.log(`🧹 진행률 정보 정리: ${taskId} (완료됨: ${info.isComplete})`);
            }
        }
    }

    // 전체 진행률 정보 (디버깅용)
    getAllProgress(): ProgressInfo[] {
        return Array.from(this.store.values());
    }

    // 작업 중단
    cancelTask(taskId: string) {
        this.store.delete(taskId);
        console.log(`🛑 작업 중단: ${taskId}`);
    }

    // 모든 작업 중단
    cancelAllTasks() {
        const count = this.store.size;
        this.store.clear();
        console.log(`🛑 모든 작업 중단: ${count}개`);
    }
}

// 싱글톤 인스턴스
export const progressStore = new ProgressStore();
export type { ProgressInfo };
