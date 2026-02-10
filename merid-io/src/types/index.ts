import { UserRole, LeaveStatus, HalfDay, ApprovalAction, WorkflowStepType, WorkflowMode } from "@prisma/client";

export type { UserRole, LeaveStatus, HalfDay, ApprovalAction, WorkflowStepType, WorkflowMode };

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      roles: UserRole[];
      officeId: string;
      language: string;
      twoFactorVerified: boolean;
      image?: string | null;
    };
  }
}

export interface LeaveRequestWithRelations {
  id: string;
  userId: string;
  leaveTypeConfigId: string;
  startDate: Date;
  endDate: Date;
  startHalfDay: HalfDay;
  endHalfDay: HalfDay;
  totalDays: number;
  reason: string | null;
  exceptionalReason: string | null;
  status: LeaveStatus;
  attachmentUrls: string[];
  isCompanyClosure: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  leaveTypeConfig: {
    id: string;
    code: string;
    label_fr: string;
    label_en: string;
    color: string;
  };
  approvalSteps: {
    id: string;
    approverId: string;
    stepType: WorkflowStepType;
    stepOrder: number;
    action: ApprovalAction | null;
    comment: string | null;
    decidedAt: Date | null;
  }[];
}

export interface LeaveBalanceSummary {
  balanceType: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remaining: number;
  carriedOverDays: number;
}

export interface TeamCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  userId: string;
  leaveType: string;
  status: LeaveStatus;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
