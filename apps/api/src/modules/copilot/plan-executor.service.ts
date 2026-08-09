import { Injectable, Logger } from '@nestjs/common';
import { type CopilotPlan, type CopilotPlanStep } from '@cf/shared';

export interface PlanExecution {
  planId: string;
  plan: CopilotPlan;
  steps: Array<CopilotPlanStep & { result?: unknown; error?: string }>;
  currentStepIndex: number;
  status: 'running' | 'done' | 'failed';
}

@Injectable()
export class PlanExecutorService {
  private readonly logger = new Logger(PlanExecutorService.name);
  private readonly executions = new Map<string, PlanExecution>();

  startPlan(userId: string, plan: CopilotPlan): string {
    this.pruneOld();
    const planId = `${userId}:${Date.now()}`;
    this.executions.set(planId, {
      planId,
      plan,
      steps: plan.steps.map((s) => ({ ...s, status: 'pending' as const })),
      currentStepIndex: 0,
      status: 'running',
    });
    this.logger.log(`Plan started planId=${planId} steps=${plan.steps.length}`);
    return planId;
  }

  getExecution(planId: string): PlanExecution | undefined {
    return this.executions.get(planId);
  }

  markStepRunning(planId: string, stepIndex: number): void {
    const exec = this.executions.get(planId);
    if (!exec) return;
    exec.steps[stepIndex] = { ...exec.steps[stepIndex], status: 'running' };
  }

  markStepDone(planId: string, stepIndex: number, result: unknown): void {
    const exec = this.executions.get(planId);
    if (!exec) return;
    exec.steps[stepIndex] = { ...exec.steps[stepIndex], status: 'done', result };
    exec.currentStepIndex = stepIndex + 1;
    if (exec.currentStepIndex >= exec.steps.length) exec.status = 'done';
  }

  markStepFailed(planId: string, stepIndex: number, error: string): void {
    const exec = this.executions.get(planId);
    if (!exec) return;
    exec.steps[stepIndex] = { ...exec.steps[stepIndex], status: 'failed', error };
    exec.status = 'failed';
  }

  pruneOld(): void {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, _exec] of this.executions) {
      const ts = parseInt(id.split(':')[1] ?? '0', 10);
      if (ts < cutoff) this.executions.delete(id);
    }
  }
}
