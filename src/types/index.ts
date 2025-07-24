// QA 테스트 관리 시스템 타입 정의

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'test_leader' | 'test_engineer';
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  test_leader_id: number;
  test_engineer_id: number;
  server: string;
  device: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'on_hold';
  created_at: string;
  updated_at: string;
}

export interface TestCategory {
  id: number;
  name: string;
  description: string;
  project_id: number;
  parent_id?: number;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: number;
  title: string;
  description: string;
  category_id: number;
  project_id: number;
  priority: 'high' | 'medium' | 'low';
  status: 'draft' | 'active' | 'deprecated';
  steps: TestStep[];
  expected_result: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface TestStep {
  id: number;
  test_case_id: number;
  step_number: number;
  action: string;
  expected_result: string;
  created_at: string;
}

export interface TestTemplate {
  id: number;
  name: string;
  description: string;
  category_id: number;
  steps: TestStep[];
  variables: TemplateVariable[];
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  id: number;
  template_id: number;
  name: string;
  description: string;
  default_value?: string;
  required: boolean;
  created_at: string;
}

export interface TestRun {
  id: number;
  test_case_id: number;
  project_id: number;
  executed_by: number;
  status: 'pass' | 'fail' | 'na' | 'holding';
  notes: string;
  execution_date: string;
  created_at: string;
  updated_at: string;
}

export interface TestExecution {
  id: number;
  test_run_id: number;
  test_step_id: number;
  status: 'pass' | 'fail' | 'na';
  notes: string;
  execution_date: string;
  created_at: string;
}

export interface TestStatistics {
  total: number;
  pass: number;
  fail: number;
  na: number;
  holding: number;
  pass_rate: number;
  cover_rate: number;
  progress_rate: number;
  defect_rate: number;
}

export interface ComponentStatistics {
  component: string;
  total: number;
  pass: number;
  fail: number;
  na: number;
  holding: number;
  pass_rate: number;
  cover_rate: number;
  defect_rate: number;
}

export interface ProjectStatistics {
  project_id: number;
  project_name: string;
  overall: TestStatistics;
  components: ComponentStatistics[];
  qa_team: {
    test_leader: string;
    test_engineer: string;
  };
  test_environment: {
    server: string;
    device: string;
  };
  test_period: {
    start_date: string;
    end_date: string;
  };
}
