import React from 'react';
import { User, RecycleBinItem } from '../userData';
import { Member } from '../memberData';
import { Group } from '../GroupsManagementPage';
import { AttendanceRecord, AttendanceStatus } from '../attendanceData';
import { Transaction } from '../financeData';
import { Equipment } from '../equipmentData';
import { MaintenanceRecord } from '../maintenanceData';
import { Visitor, FollowUp } from '../visitorData';
import { Branch } from '../branchData';
import { PermissionRequest } from '../PermissionRequest';
import { SmsRecord } from '../smsData';

import DashboardPage from '../DashboardPage';
import MembersPage from '../MembersPage';
import AddMemberPage from '../AddMemberPage';
import MemberDetailsPage from '../MemberDetailsPage';
import GroupsManagementPage from '../GroupsManagementPage';
import BirthdaysPage from '../BirthdaysPage';
import AttendanceModule from '../AttendanceModule';
import MarkAttendancePage from '../MarkAttendancePage';
import FinancePage from '../FinancePage';
import AddTransactionPage from '../AddTransactionPage';
import SmsBroadcastPage from '../SmsBroadcastPage';
import EquipmentPage from '../EquipmentPage';
import AddEquipmentPage from '../AddEquipmentPage';
import AddMaintenancePage from '../AddMaintenancePage';
import VisitorsModule from '../VisitorsModule';
import ReportsModule from '../ReportsModule';
import UsersPage from '../UsersPage';
import AddUserPage from '../AddUserPage';
import SettingsPage from '../SettingsPage';
import AiFeaturesPage from '../AiFeaturesPage';
import HelpdeskPage from '../HelpdeskPage';
import BranchesPage from '../BranchesPage';
import AddBranchPage from '../AddBranchPage';
import DataPersonnelManagementPage from '../DataPersonnelManagementPage';
import RecycleBinPage from '../RecycleBinPage';
import PermissionRequestsPage from '../PermissionRequestsPage';
import UserSessionMonitor from '../UserSessionMonitor';

export interface AppRouterProps {
  activePage: string;
  setActivePage: (page: string) => void;
  currentUser: User | null;

  // Data & handlers
  members: Member[];
  memberTotalCount: number;
  memberToEdit: Member | null;
  setMemberToEdit: (m: Member | null) => void;
  memberToView: Member | null;
  setMemberToView: (m: Member | null) => void;
  handleSaveOrUpdateMember: (m: Partial<Member>) => Promise<void>;
  handleDeleteMember: (id: string) => Promise<void>;
  handleStartEditMember: (m: Member) => void;
  handleStartViewMember: (m: Member) => void;

  groups: Group[];
  groupToEdit: Group | null;
  setGroupToEdit: (g: Group | null) => void;
  handleSaveOrUpdateGroup: (g: Partial<Group>) => Promise<void>;
  handleDeleteGroup: (id: number) => Promise<void>;
  handleStartEditGroup: (g: Group) => void;

  attendanceRecords: AttendanceRecord[];
  editContext: { date: string; service: string } | null;
  setEditContext: (c: { date: string; service: string } | null) => void;
  handleSaveAttendance: (
    newAttendance: Record<string, AttendanceStatus>,
    serviceName: string,
    serviceDate: string,
  ) => Promise<void>;
  handleEditAttendanceRecord: (date: string, service: string) => void;
  handleDeleteAttendanceRecord: (id: number) => Promise<void>;

  transactions: Transaction[];
  transactionToEdit: Transaction | null;
  setTransactionToEdit: (t: Transaction | null) => void;
  handleSaveOrUpdateTransaction: (t: Omit<Transaction, 'id'> | Transaction) => Promise<void>;
  handleDeleteTransaction: (id: number) => Promise<void>;
  handleStartEditTransaction: (t: Transaction) => void;

  smsRecords: SmsRecord[];
  addSmsRecord: (record: Omit<SmsRecord, 'id'>) => Promise<void>;
  deleteSmsRecord: (id: number) => Promise<void>;
  loadMoreSms: () => void;
  smsMonthsBack: number;

  equipment: Equipment[];
  maintenanceRecords: MaintenanceRecord[];
  equipmentToEdit: Equipment | null;
  setEquipmentToEdit: (e: Equipment | null) => void;
  maintenanceToEdit: MaintenanceRecord | null;
  setMaintenanceToEdit: (m: MaintenanceRecord | null) => void;
  handleSaveOrUpdateEquipment: (equipmentData: Omit<Equipment, 'id'> | Equipment) => Promise<void>;
  handleDeleteEquipment: (id: number) => Promise<void>;
  handleStartEditEquipment: (e: Equipment) => void;
  handleSaveOrUpdateMaintenance: (m: Omit<MaintenanceRecord, 'id'>) => Promise<void>;
  handleDeleteMaintenance: (id: number) => Promise<void>;
  handleStartEditMaintenance: (m: MaintenanceRecord) => void;

  visitors: Visitor[];
  handleSaveOrUpdateVisitor: (v: Partial<Visitor>) => Promise<void>;
  handleDeleteVisitor: (visitorId: number) => void;
  handleConvertToMember: (visitorId: number) => void;
  handleSaveFollowUp: (visitorId: number, followUpData: Omit<FollowUp, 'id' | 'visitorId'>) => Promise<void>;
  handleDeleteFollowUp: (visitorId: number, followUpId: number) => Promise<void>;

  allUsers: User[];
  userToEdit: User | null;
  setUserToEdit: (u: User | null) => void;
  onSaveOrUpdateUser: (u: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
  handleStartEditUser: (u: User) => void;
  handleSaveUser: (u: Partial<User>) => void;

  branches: Branch[];
  branchToEdit: Branch | null;
  setBranchToEdit: (b: Branch | null) => void;
  handleSaveBranch: (b: Partial<Branch>) => Promise<void>;
  handleDeleteBranch: (id: string) => Promise<void>;
  handleStartEditBranch: (b: Branch) => void;
  handleViewBranch: (b: Branch) => void;

  recycleBinItems: RecycleBinItem[];
  handleRestoreFromRecycleBin: (item: RecycleBinItem) => Promise<void>;
  removeFromRecycleBin: (id: string) => Promise<void>;
  handleEmptyRecycleBin: () => Promise<void>;

  permissionRequests: PermissionRequest[];
  handleReviewPermissionRequest: (requestId: string, action: 'approve' | 'deny', notes: string) => Promise<void>;
}

/**
 * Extracted presentational router component for MainLayout.
 * Maps activePage string to the corresponding page view.
 */
const AppRouter: React.FC<AppRouterProps> = (props) => {
  const { activePage } = props;

  switch (activePage) {
    case 'Dashboard':
      return (
        <DashboardPage
          setActivePage={props.setActivePage}
          members={props.members}
          totalMembersCount={props.memberTotalCount}
          transactions={props.transactions}
          onAddTransaction={() => {
            props.setTransactionToEdit(null);
            props.setActivePage('Add Transaction');
          }}
          currentUser={props.currentUser}
        />
      );
    case 'Members':
      return (
        <MembersPage
          setActivePage={props.setActivePage}
          members={props.members}
          onDeleteMember={props.handleDeleteMember}
          onEditMember={props.handleStartEditMember}
          onViewMember={props.handleStartViewMember}
        />
      );
    case 'Add Member':
      return (
        <AddMemberPage
          onBack={() => {
            props.setMemberToEdit(null);
            props.setActivePage('Members');
          }}
          onSave={props.handleSaveOrUpdateMember}
          memberToEdit={props.memberToEdit}
        />
      );
    case 'Member Details':
      if (props.memberToView) {
        return (
          <MemberDetailsPage
            member={props.memberToView}
            onBack={() => {
              props.setMemberToView(null);
              props.setActivePage('Members');
            }}
            onEdit={props.handleStartEditMember}
            onDelete={props.handleDeleteMember}
            transactions={props.transactions}
            attendanceRecords={props.attendanceRecords}
          />
        );
      }
      return (
        <MembersPage
          setActivePage={props.setActivePage}
          members={props.members}
          onDeleteMember={props.handleDeleteMember}
          onEditMember={props.handleStartEditMember}
          onViewMember={props.handleStartViewMember}
        />
      );
    case 'Manage Groups':
      return (
        <GroupsManagementPage
          onBack={() => props.setActivePage('Members')}
          members={props.members}
          groups={props.groups}
          onSaveGroup={props.handleSaveOrUpdateGroup}
          onDeleteGroup={props.handleDeleteGroup}
          onEditGroup={props.handleStartEditGroup}
          groupToEdit={props.groupToEdit}
          setGroupToEdit={props.setGroupToEdit}
        />
      );
    case 'Birthdays':
      return <BirthdaysPage members={props.members} />;
    case 'Attendance':
      return (
        <AttendanceModule
          setActivePage={props.setActivePage}
          members={props.members}
          editContext={props.editContext}
          setEditContext={props.setEditContext}
          attendanceRecords={props.attendanceRecords}
          onEditAttendanceRecord={props.handleEditAttendanceRecord}
          onDeleteAttendanceRecord={props.handleDeleteAttendanceRecord}
        />
      );
    case 'Mark Attendance':
      return (
        <MarkAttendancePage
          onBack={() => {
            props.setEditContext(null);
            props.setActivePage('Attendance');
          }}
          onSave={props.handleSaveAttendance}
          editContext={props.editContext}
          allAttendanceRecords={props.attendanceRecords}
          members={props.members}
        />
      );
    case 'Finance':
      return (
        <FinancePage
          currentUser={props.currentUser}
          transactions={props.transactions}
          members={props.members}
          onEditTransaction={props.handleStartEditTransaction}
          onDeleteTransaction={props.handleDeleteTransaction}
          setActivePage={props.setActivePage}
        />
      );
    case 'Add Transaction':
      return (
        <AddTransactionPage
          onBack={() => {
            props.setTransactionToEdit(null);
            props.setActivePage('Finance');
          }}
          onSave={props.handleSaveOrUpdateTransaction}
          transactionToEdit={props.transactionToEdit}
          members={props.members}
          transactions={props.transactions}
        />
      );
    case 'SMS Broadcast':
      return (
        <SmsBroadcastPage
          members={props.members}
          groups={props.groups}
          smsRecords={props.smsRecords}
          onLogSms={props.addSmsRecord}
          onDeleteSms={props.deleteSmsRecord}
          onLoadMoreSms={props.loadMoreSms}
          smsMonthsBack={props.smsMonthsBack}
        />
      );
    case 'Equipment':
      return (
        <EquipmentPage
          setActivePage={props.setActivePage}
          equipment={props.equipment}
          onEdit={props.handleStartEditEquipment}
          onDelete={props.handleDeleteEquipment}
          maintenanceRecords={props.maintenanceRecords}
          onEditMaintenance={props.handleStartEditMaintenance}
          onDeleteMaintenance={props.handleDeleteMaintenance}
        />
      );
    case 'Add Equipment':
      return (
        <AddEquipmentPage
          onBack={() => {
            props.setEquipmentToEdit(null);
            props.setActivePage('Equipment');
          }}
          onSave={props.handleSaveOrUpdateEquipment}
          equipmentToEdit={props.equipmentToEdit}
        />
      );
    case 'Add Maintenance':
      return (
        <AddMaintenancePage
          onBack={() => {
            props.setMaintenanceToEdit(null);
            props.setActivePage('Equipment');
          }}
          onSave={props.handleSaveOrUpdateMaintenance}
          recordToEdit={props.maintenanceToEdit}
          equipment={props.equipment}
        />
      );
    case 'Visitors':
      return (
        <VisitorsModule
          visitors={props.visitors}
          onSaveVisitor={props.handleSaveOrUpdateVisitor}
          onUpdateVisitor={props.handleSaveOrUpdateVisitor}
          onDeleteVisitor={props.handleDeleteVisitor}
          onConvertToMember={props.handleConvertToMember}
          onSaveFollowUp={props.handleSaveFollowUp}
          onDeleteFollowUp={props.handleDeleteFollowUp}
          members={props.members}
        />
      );
    case 'Reports':
      return (
        <ReportsModule
          members={props.members}
          transactions={props.transactions}
          attendanceRecords={props.attendanceRecords}
        />
      );
    case 'Users':
      return (
        <UsersPage
          users={props.allUsers}
          setActivePage={props.setActivePage}
          onDeleteUser={props.onDeleteUser}
          onEditUser={props.handleStartEditUser}
        />
      );
    case 'Add User':
      return (
        <AddUserPage
          onBack={() => {
            props.setUserToEdit(null);
            props.setActivePage('Users');
          }}
          onSave={props.handleSaveUser}
          userToEdit={props.userToEdit}
        />
      );
    case 'Settings':
      return <SettingsPage currentUser={props.currentUser} />;
    case 'AI Features':
      return <AiFeaturesPage />;
    case 'Helpdesk':
      return <HelpdeskPage />;
    case 'Branches':
      return (
        <BranchesPage
          branches={props.branches}
          onAddBranch={() => {
            props.setBranchToEdit(null);
            props.setActivePage('Add Branch');
          }}
          onEditBranch={props.handleStartEditBranch}
          onDeleteBranch={props.handleDeleteBranch}
          onViewBranch={props.handleViewBranch}
          canEdit={props.currentUser?.role === 'Super Admin' || props.currentUser?.role === 'Admin'}
        />
      );
    case 'Add Branch':
      return (
        <AddBranchPage
          onBack={() => {
            props.setBranchToEdit(null);
            props.setActivePage('Branches');
          }}
          onSave={props.handleSaveBranch}
          branchToEdit={props.branchToEdit}
        />
      );
    case 'Data Personnel Management':
      return props.currentUser ? (
        <DataPersonnelManagementPage
          users={props.allUsers}
          currentUser={props.currentUser}
          onUpdateUser={props.onSaveOrUpdateUser}
          onDeleteUser={props.onDeleteUser}
        />
      ) : null;
    case 'Recycle Bin':
      return (
        <RecycleBinPage
          currentUser={props.currentUser!}
          recycleBinItems={props.recycleBinItems}
          onRestore={props.handleRestoreFromRecycleBin}
          onPermanentlyDelete={props.removeFromRecycleBin}
          onEmptyBin={props.handleEmptyRecycleBin}
        />
      );
    case 'Permission Requests':
      return (
        <PermissionRequestsPage
          currentUser={props.currentUser!}
          permissionRequests={props.permissionRequests}
          onReview={props.handleReviewPermissionRequest}
        />
      );
    case 'User Session Monitor':
      return props.currentUser ? <UserSessionMonitor currentUser={props.currentUser} /> : null;
    default:
      return (
        <DashboardPage
          setActivePage={props.setActivePage}
          members={props.members}
          totalMembersCount={props.memberTotalCount}
          transactions={props.transactions}
          onAddTransaction={() => {
            props.setTransactionToEdit(null);
            props.setActivePage('Add Transaction');
          }}
          currentUser={props.currentUser}
        />
      );
  }
};

export default AppRouter;
