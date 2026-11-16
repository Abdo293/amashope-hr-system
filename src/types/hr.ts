export type HRRole = 'admin' | 'employee';

export interface HRUser {
  id: string;
  full_name: string;
  role: HRRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  email?: string;
  must_change_password: boolean;
  password_changed_at?: string | null;
}

export type ProjectStatus = 'active' | 'archived';

export interface HRProject {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  members_count?: number;
  tasks_count?: number;
  completed_tasks_count?: number;
}

export interface HRProjectMember {
  project_id: string;
  user_id: string;
  joined_at: string;
  hr_users?: HRUser;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface HRTaskAssignee {
  task_id: string;
  user_id: string;
  assigned_at?: string;
  assigned_by?: string;
  hr_users?: HRUser;
}

export interface HRTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assignee_id?: string | null;
  status: TaskStatus;
  due_date: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  hr_users?: HRUser;
  hr_projects?: HRProject;
  hr_task_assignees?: {
    user_id: string;
    hr_users?: HRUser;
  }[];
}

export interface HRTaskFile {
  id: string;
  task_id: string;
  uploaded_by: string;
  storage_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  hr_users?: HRUser;
}

export interface HRTaskActivity {
  id: string;
  task_id: string;
  actor_id: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  hr_users?: HRUser;
}
