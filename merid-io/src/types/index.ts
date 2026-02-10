import { Role, LeaveStatus, DayPeriod } from "@prisma/client";

export type { Role, LeaveStatus, DayPeriod };

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      image?: string | null;
    };
  }
}

export interface LeaveRequestWithRelations {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  startPeriod: DayPeriod;
  endPeriod: DayPeriod;
  totalDays: number;
  reason: string | null;
  status: LeaveStatus;
  attachmentUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  leaveType: {
    id: string;
    name: string;
    code: string;
    color: string | null;
  };
}

export interface LeaveBalanceSummary {
  leaveType: string;
  code: string;
  entitled: number;
  taken: number;
  pending: number;
  remaining: number;
  color: string | null;
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
