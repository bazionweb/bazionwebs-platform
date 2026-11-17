import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Heart,
  LogOut,
  Download,
  User,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  ChevronRight,
  Edit2,
  Save,
  X,
  Calendar,
  TrendingUp,
  Shield,
  Menu,
  Settings2,
} from 'lucide-react';
import AvatarEditor from '../../components/AvatarEditor';
import { useNavigate } from 'react-router-dom';
import { portalAuthService } from '../services/portalAuth';
import { portalApolloClient } from '../services/portalApollo';
import {
  GET_MEMBER_DASHBOARD_QUERY,
  UPDATE_MEMBER_PROFILE_MUTATION,
  SUBMIT_HELPDESK_TICKET_MUTATION,
  GET_CHURCH_SETTINGS_QUERY,
} from '../services/portalQueries';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { compressImage } from '../../utils/imageUtils';
// ─── Types ───────────────────────────────────────────────────────────────────
interface MemberData {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  department?: string;
  status: string;
  joined_at?: string;
  gender?: string;
  marital_status?: string;
  address?: string;
  occupation?: string;
  dob?: string;
  avatar?: string;
}

interface Transaction {
  id: number;
  date: string;
  category: string;
  amount: number;
  description?: string;
}

interface AttendanceRecord {
  id: number;
  date: string;
  service: string;
  status: string;
}

// ─── Brand Colors ────────────────────────────────────────────────────────────
const BRAND = {
  darkNavy: '#0f172a',
  deepPurple: '#1e1a3c',
  purple: '#2d1a4a',
  gold: '#d4af37',
  goldDark: '#b8960c',
  goldLight: '#f5e27e',
  white: '#ffffff',
};

// ─── Inline Styles ───────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#f1f5f9',
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    display: 'flex',
  },
  sidebar: {
    width: 260,
    minWidth: 260,
    background: `linear-gradient(180deg, ${BRAND.darkNavy} 0%, ${BRAND.deepPurple} 60%, ${BRAND.purple} 100%)`,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    position: 'sticky' as const,
    top: 0,
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: '28px 24px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  logoImg: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: `2px solid ${BRAND.gold}`,
    objectFit: 'contain' as const,
    background: '#e0f2fe',
    padding: 2,
  },
  logoText: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: BRAND.gold,
    lineHeight: 1.3,
  },
  goldDivider: {
    height: 1,
    background: `linear-gradient(90deg, transparent, ${BRAND.gold}, transparent)`,
    margin: '0 0 16px',
    opacity: 0.5,
  },
  welcomeLabel: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  welcomeName: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: BRAND.white,
    marginBottom: 2,
    wordBreak: 'break-all' as const,
  },
  memberId: {
    fontSize: '0.75rem',
    color: BRAND.gold,
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  navFooter: {
    padding: '12px 12px 24px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  main: {
    flex: 1,
    padding: '32px 32px',
    maxWidth: '100%',
    overflowX: 'hidden' as const,
  },
  pageHeader: {
    marginBottom: 28,
  },
  pageTitle: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: BRAND.darkNavy,
    letterSpacing: '-0.02em',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '0.875rem',
    color: '#64748b',
    margin: '4px 0 0',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
    marginBottom: 24,
  },
  statCard: {
    background: BRAND.white,
    borderRadius: 16,
    padding: '20px 22px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.05)',
  },
  statLabel: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#94a3b8',
    marginBottom: 10,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: BRAND.darkNavy,
    letterSpacing: '-0.02em',
  },
  statHint: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: 4,
  },
  panel: {
    background: BRAND.white,
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.05)',
    marginBottom: 20,
    overflow: 'hidden' as const,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid #f1f5f9',
  },
  panelTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: BRAND.darkNavy,
    margin: 0,
  },
  panelBody: {
    padding: '20px 24px',
  },
  tableHeader: {
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  th: {
    padding: '10px 16px',
    textAlign: 'left' as const,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: '#94a3b8',
  },
  td: {
    padding: '13px 16px',
    fontSize: '0.875rem',
    color: '#334155',
    borderBottom: '1px solid #f1f5f9',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
};

const getNavStyle = (isActive: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  transition: 'all 0.15s',
  background: isActive ? 'rgba(212,175,55,0.15)' : 'transparent',
  color: isActive ? BRAND.gold : 'rgba(255,255,255,0.6)',
  textAlign: 'left' as const,
  borderLeft: isActive ? `3px solid ${BRAND.gold}` : '3px solid transparent',
});

const getBadgeStyle = (status: string): React.CSSProperties => {
  const map: Record<string, { bg: string; color: string }> = {
    Active: { bg: '#dcfce7', color: '#15803d' },
    Inactive: { bg: '#f1f5f9', color: '#64748b' },
    Transferred: { bg: '#fef9c3', color: '#a16207' },
    'Pending Fee': { bg: '#ffedd5', color: '#c2410c' },
    Present: { bg: '#dcfce7', color: '#15803d' },
    Absent: { bg: '#fee2e2', color: '#b91c1c' },
  };
  const s = map[status] || { bg: '#f1f5f9', color: '#64748b' };
  return { ...S.badge, background: s.bg, color: s.color };
};

const SkeletonBlock = ({ w = '100%', h = 16 }: { w?: string | number; h?: number }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 8,
      background: 'linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      marginBottom: 8,
    }}
  />
);

const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
      textAlign: 'center',
    }}
  >
    <AlertCircle style={{ color: '#ef4444', marginBottom: 12 }} size={32} />
    <p style={{ color: '#64748b', marginBottom: 16, fontSize: '0.875rem' }}>Could not load data. Please try again.</p>
    <button
      onClick={onRetry}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#fef2f2',
        color: '#b91c1c',
        border: '1px solid #fecaca',
        borderRadius: 8,
        padding: '8px 16px',
        cursor: 'pointer',
        fontSize: '0.825rem',
        fontWeight: 600,
      }}
    >
      <RefreshCw size={14} /> Retry
    </button>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const MemberDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const currentUser = portalAuthService.getCurrentUser();

  const [memberData, setMemberData] = useState<MemberData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [churchInfo, setChurchInfo] = useState<{ name: string; address: string; phone: string; email: string } | null>(
    null,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<MemberData>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string | null>(null);

  const [ticketDepartment, setTicketDepartment] = useState('General');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketBody, setTicketBody] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [ticketError, setTicketError] = useState('');

  const fetchDashboard = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await portalApolloClient.query({
        query: GET_MEMBER_DASHBOARD_QUERY,
        variables: { memberId: currentUser.id },
        fetchPolicy: 'network-only',
      });
      setMemberData(data.membersCollection?.edges?.[0]?.node ?? null);
      setTransactions(data.transactionsCollection?.edges?.map((e: { node: Transaction }) => e.node) ?? []);
      setAttendance(data.attendance_recordsCollection?.edges?.map((e: { node: AttendanceRecord }) => e.node) ?? []);
    } catch {
      setError('Failed to load dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Fetch church info from DB (first branch = main church)
  useEffect(() => {
    portalApolloClient
      .query({ query: GET_CHURCH_SETTINGS_QUERY, fetchPolicy: 'network-only' })
      .then((res) => {
        const node = res.data?.church_settingsCollection?.edges?.[0]?.node;
        if (node) {
          setChurchInfo({
            name: node.name || '',
            address: node.address || '',
            phone: node.phone || '',
            email: node.email || '',
          });
        }
      })
      .catch(() => {
        /* silently fail */
      });
  }, []);

  const handleLogout = () => {
    portalAuthService.logout();
    navigate('/portal/login');
  };

  const handleDownloadStatement = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header styling
    doc.setFillColor(15, 23, 42); // Dark navy
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Add Logo text (placeholder if we can't load image sync)
    doc.setTextColor(212, 175, 55); // Gold
    doc.setFontSize(16);
    doc.text((churchInfo?.name || 'HKM Ministries').toUpperCase(), pageWidth / 2, 20, { align: 'center' });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Member Giving Statement', pageWidth / 2, 28, { align: 'center' });
    if (churchInfo?.address || churchInfo?.phone) {
      doc.setFontSize(8);
      doc.text([churchInfo?.address, churchInfo?.phone].filter(Boolean).join('  |  '), pageWidth / 2, 35, {
        align: 'center',
      });
    }

    // Member Details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Name: ${currentUser?.full_name || 'Member'}`, 14, 55);
    doc.text(`Membership No: ${currentUser?.id || ''}`, 14, 62);
    doc.text(`Date Printed: ${new Date().toLocaleDateString()}`, 14, 69);

    const totalAmount = transactions
      .filter((t) => new Date(t.date).getFullYear() === new Date().getFullYear())
      .reduce((sum, t) => sum + Number(t.amount), 0);

    doc.text(`YTD Total (${new Date().getFullYear()}): KES ${totalAmount.toLocaleString('en-KE')}`, 14, 76);

    // Table
    const tableData = transactions.map((t) => [
      t.date,
      t.category || 'Tithe',
      `KES ${Number(t.amount).toLocaleString('en-KE')}`,
    ]);

    autoTable(doc, {
      startY: 85,
      head: [['Date', 'Category', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [212, 175, 55] },
      styles: { fontSize: 10, cellPadding: 6 },
    });

    // Footer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable.finalY || 100;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for your faithfulness and continued support.', pageWidth / 2, finalY + 15, { align: 'center' });

    doc.save(`giving-statement-${currentUser?.id || 'member'}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleStartEdit = () => {
    if (!memberData) return;
    setProfileForm({
      phone: memberData.phone,
      email: memberData.email,
      address: memberData.address,
      occupation: memberData.occupation,
      marital_status: memberData.marital_status,
      avatar: memberData.avatar,
    });
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser?.id) return;
    setSavingProfile(true);
    try {
      await portalApolloClient.mutate({
        mutation: UPDATE_MEMBER_PROFILE_MUTATION,
        variables: {
          id: currentUser.id,
          updates: {
            phone: profileForm.phone,
            email: profileForm.email,
            address: profileForm.address,
            occupation: profileForm.occupation,
            marital_status: profileForm.marital_status,
            avatar: profileForm.avatar,
          },
        },
      });
      setProfileSaved(true);
      setIsEditing(false);
      await fetchDashboard();
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      alert('Failed to save profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !ticketSubject || !ticketBody) return;
    setSubmittingTicket(true);
    setTicketError('');
    try {
      await portalApolloClient.mutate({
        mutation: SUBMIT_HELPDESK_TICKET_MUTATION,
        variables: {
          sender_id: currentUser.id,
          department: ticketDepartment,
          subject: ticketSubject,
          body: ticketBody,
        },
      });
      setTicketSubmitted(true);
      setTicketSubject('');
      setTicketBody('');
      setTicketDepartment('General');
    } catch {
      setTicketError('Failed to submit your message. Please try again.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (JPEG, PNG, etc.).');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be under 10MB. Please choose a smaller file.');
        return;
      }
      try {
        const compressedBase64 = await compressImage(file, 600, 600, 0.9); // Higher quality initial compression for the editor
        setTempAvatarUrl(compressedBase64);
        setShowAvatarEditor(true);
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Failed to process the image. Please try again.');
      }
    }
  };

  const ytdTotal = transactions
    .filter((t) => new Date(t.date).getFullYear() === new Date().getFullYear())
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // ─── Render: Dashboard ────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div>
      <div style={S.pageHeader}>
        <h2 style={S.pageTitle}>Dashboard Overview</h2>
        <p style={S.pageSubtitle}>
          Welcome back, {memberData?.first_name || currentUser?.full_name?.split(' ')[0] || 'Member'} 👋
        </p>
      </div>

      {/* Stat Cards */}
      <div style={S.cardGrid}>
        <div style={S.statCard}>
          <div style={{ ...S.statIconWrap, background: '#eff6ff' }}>
            <Shield size={20} color="#3b82f6" />
          </div>
          <p style={S.statLabel}>Member Status</p>
          {loading ? (
            <SkeletonBlock h={28} w={100} />
          ) : (
            <span style={getBadgeStyle(memberData?.status || 'Unknown')}>{memberData?.status || 'Unknown'}</span>
          )}
        </div>

        <div style={S.statCard}>
          <div style={{ ...S.statIconWrap, background: '#faf5ff' }}>
            <User size={20} color="#8b5cf6" />
          </div>
          <p style={S.statLabel}>Department</p>
          {loading ? (
            <SkeletonBlock h={28} w={140} />
          ) : (
            <p style={{ ...S.statValue, fontSize: '1rem' }}>{memberData?.department || '—'}</p>
          )}
        </div>

        <div style={{ ...S.statCard, background: `linear-gradient(135deg, ${BRAND.darkNavy}, ${BRAND.deepPurple})` }}>
          <div style={{ ...S.statIconWrap, background: 'rgba(212,175,55,0.15)' }}>
            <TrendingUp size={20} color={BRAND.gold} />
          </div>
          <p style={{ ...S.statLabel, color: 'rgba(255,255,255,0.5)' }}>YTD Giving</p>
          {loading ? (
            <SkeletonBlock h={32} w={120} />
          ) : (
            <p style={{ ...S.statValue, color: BRAND.gold }}>
              KES {ytdTotal.toLocaleString('en-KE', { maximumFractionDigits: 0 })}
            </p>
          )}
          <p style={{ ...S.statHint, color: 'rgba(255,255,255,0.4)' }}>Thank you for your faithfulness ❤️</p>
        </div>
      </div>

      {/* My Details */}
      <div style={S.panel}>
        <div style={S.panelHeader}>
          <h3 style={S.panelTitle}>My Details</h3>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              color: BRAND.gold,
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Edit Profile <ChevronRight size={14} />
          </button>
        </div>
        <div style={{ ...S.panelBody, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
          {loading ? (
            <>
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
            </>
          ) : (
            [
              ['Membership No.', memberData?.id],
              ['Phone', memberData?.phone || '—'],
              ['Email', memberData?.email || '—'],
              [
                'Member Since',
                memberData?.joined_at
                  ? new Date(memberData.joined_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long' })
                  : '—',
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <p
                  style={{
                    fontSize: '0.7rem',
                    color: '#94a3b8',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                >
                  {label}
                </p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{value}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Giving */}
      <div style={S.panel}>
        <div style={S.panelHeader}>
          <h3 style={S.panelTitle}>Recent Giving</h3>
          <button
            onClick={() => setActiveTab('giving')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              color: BRAND.gold,
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View All <ChevronRight size={14} />
          </button>
        </div>
        <div style={S.panelBody}>
          {loading ? (
            <>
              <SkeletonBlock />
              <SkeletonBlock />
            </>
          ) : error ? (
            <ErrorState onRetry={fetchDashboard} />
          ) : transactions.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '24px 0' }}>
              No giving records found.
            </p>
          ) : (
            <div>
              {transactions.slice(0, 4).map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem', marginBottom: 2 }}>
                      {t.category}
                    </p>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      {new Date(t.date).toLocaleDateString('en-KE', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <p style={{ fontWeight: 700, color: BRAND.darkNavy, fontSize: '0.9rem' }}>
                    KES {t.amount.toLocaleString('en-KE')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Render: Giving ───────────────────────────────────────────────────────
  const renderGiving = () => (
    <div>
      <div style={{ ...S.pageHeader, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={S.pageTitle}>My Giving History</h2>
          <p style={S.pageSubtitle}>A complete record of your contributions</p>
        </div>
        <button
          onClick={handleDownloadStatement}
          disabled={loading || transactions.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: BRAND.darkNavy,
            color: BRAND.gold,
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            fontSize: '0.825rem',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: loading || transactions.length === 0 ? 0.5 : 1,
          }}
        >
          <Download size={15} /> Download Statement
        </button>
      </div>
      <div style={S.panel}>
        {loading ? (
          <div style={{ padding: 24 }}>
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        ) : error ? (
          <ErrorState onRetry={fetchDashboard} />
        ) : transactions.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px', fontSize: '0.875rem' }}>
            No giving records found.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={S.tableHeader}>
                <th style={S.th}>Date</th>
                <th style={S.th}>Category</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Amount (KES)</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td style={S.td}>
                    {new Date(t.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: '#eff6ff', color: '#1d4ed8' }}>{t.category}</span>
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>{t.amount.toLocaleString('en-KE')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                <td colSpan={2} style={{ ...S.td, fontWeight: 700, color: BRAND.darkNavy }}>
                  YTD Total ({new Date().getFullYear()})
                </td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 800, color: BRAND.darkNavy, fontSize: '1rem' }}>
                  {ytdTotal.toLocaleString('en-KE')}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );

  // ─── Render: Attendance ───────────────────────────────────────────────────
  const renderAttendance = () => (
    <div>
      <div style={S.pageHeader}>
        <h2 style={S.pageTitle}>My Attendance</h2>
        <p style={S.pageSubtitle}>Your service attendance records</p>
      </div>
      <div style={S.panel}>
        {loading ? (
          <div style={{ padding: 24 }}>
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
        ) : error ? (
          <ErrorState onRetry={fetchDashboard} />
        ) : attendance.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px', fontSize: '0.875rem' }}>
            No attendance records found.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={S.tableHeader}>
                <th style={S.th}>Date</th>
                <th style={S.th}>Service</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((a) => (
                <tr key={a.id}>
                  <td style={S.td}>
                    {new Date(a.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={S.td}>{a.service}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>
                    <span style={getBadgeStyle(a.status)}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ─── Render: Profile ──────────────────────────────────────────────────────
  const renderProfile = () => (
    <div>
      <div style={{ ...S.pageHeader, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={S.pageTitle}>My Profile</h2>
          <p style={S.pageSubtitle}>View and update your personal information</p>
        </div>
        {!isEditing ? (
          <button
            onClick={handleStartEdit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: BRAND.darkNavy,
              color: BRAND.gold,
              border: 'none',
              borderRadius: 10,
              padding: '10px 18px',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Edit2 size={15} /> Edit Details
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setIsEditing(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#f1f5f9',
                color: '#64748b',
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <X size={15} /> Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: BRAND.darkNavy,
                color: BRAND.gold,
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: savingProfile ? 0.7 : 1,
              }}
            >
              <Save size={15} /> {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {profileSaved && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle size={18} /> Profile updated successfully!
        </div>
      )}

      <div style={S.panel}>
        <div style={S.panelHeader}>
          <h3 style={S.panelTitle}>Member Information</h3>
        </div>
        <div style={{ ...S.panelBody }}>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: 20 }}>
            You can only edit your personal contact details. For name changes or other corrections, please contact the
            church office.
          </p>
          {loading ? (
            <>
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
            </>
          ) : (
            <div>
              {/* Avatar Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                {isEditing ? (
                  <>
                    <div style={{ position: 'relative', width: 80, height: 80 }}>
                      <img
                        src={
                          profileForm.avatar ||
                          memberData?.avatar ||
                          `https://ui-avatars.com/api/?name=${memberData?.first_name}+${memberData?.last_name}&background=0f172a&color=d4af37`
                        }
                        alt="Avatar"
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '2px solid #d4af37',
                        }}
                      />
                      <label
                        style={{
                          position: 'absolute',
                          bottom: -5,
                          right: -5,
                          background: '#10b981',
                          color: 'white',
                          borderRadius: '50%',
                          padding: 6,
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                      >
                        <Edit2 size={12} />
                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                      </label>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>Profile Photo</p>
                      <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>
                        Click the icon to upload a new image. Max 10MB.
                      </p>
                      {(profileForm.avatar || tempAvatarUrl) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!tempAvatarUrl && profileForm.avatar) setTempAvatarUrl(profileForm.avatar);
                            setShowAvatarEditor(true);
                          }}
                          style={{
                            fontSize: '0.75rem',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <Settings2 size={12} />
                          Adjust position & zoom
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  memberData?.avatar && (
                    <img
                      src={memberData.avatar}
                      alt="Avatar"
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #e2e8f0',
                      }}
                    />
                  )
                )}
              </div>

              {/* Avatar Editor Modal */}
              {showAvatarEditor && tempAvatarUrl && (
                <AvatarEditor
                  imageUrl={tempAvatarUrl}
                  onSave={(croppedImageUrl) => {
                    setProfileForm((prev) => ({
                      ...prev,
                      avatar: croppedImageUrl,
                    }));
                    setShowAvatarEditor(false);
                  }}
                  onCancel={() => setShowAvatarEditor(false)}
                />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 32px' }}>
                {[
                  { label: 'Full Name', value: `${memberData?.first_name} ${memberData?.last_name}`.trim() },
                  { label: 'Membership No.', value: memberData?.id },
                  { label: 'Department', value: memberData?.department },
                  { label: 'Gender', value: memberData?.gender },
                  { label: 'Status', value: memberData?.status },
                  {
                    label: 'Member Since',
                    value: memberData?.joined_at
                      ? new Date(memberData.joined_at).toLocaleDateString('en-KE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '—',
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p
                      style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        marginBottom: 6,
                      }}
                    >
                      {label}
                    </p>
                    <p
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#1e293b',
                        background: '#f8fafc',
                        padding: '8px 12px',
                        borderRadius: 8,
                      }}
                    >
                      {value || '—'}
                    </p>
                  </div>
                ))}

                {[
                  { label: 'Phone Number', key: 'phone' },
                  { label: 'Email Address', key: 'email' },
                  { label: 'Home Address', key: 'address' },
                  { label: 'Occupation', key: 'occupation' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <p
                      style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                        marginBottom: 6,
                      }}
                    >
                      {label} {isEditing && <span style={{ color: BRAND.gold }}>✎</span>}
                    </p>
                    {isEditing ? (
                      <input
                        type="text"
                        value={(profileForm as Record<string, string>)[key] || ''}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        style={{
                          width: '100%',
                          fontSize: '0.875rem',
                          border: `1.5px solid ${BRAND.gold}`,
                          borderRadius: 8,
                          padding: '8px 12px',
                          outline: 'none',
                          boxSizing: 'border-box',
                          background: '#fffbeb',
                        }}
                      />
                    ) : (
                      <p
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: '#1e293b',
                          background: '#f8fafc',
                          padding: '8px 12px',
                          borderRadius: 8,
                        }}
                      >
                        {((memberData as unknown as Record<string, unknown>)?.[key] as string) || '—'}
                      </p>
                    )}
                  </div>
                ))}

                <div>
                  <p
                    style={{
                      fontSize: '0.7rem',
                      color: '#94a3b8',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      marginBottom: 6,
                    }}
                  >
                    Marital Status {isEditing && <span style={{ color: BRAND.gold }}>✎</span>}
                  </p>
                  {isEditing ? (
                    <select
                      value={profileForm.marital_status || ''}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, marital_status: e.target.value }))}
                      style={{
                        width: '100%',
                        fontSize: '0.875rem',
                        border: `1.5px solid ${BRAND.gold}`,
                        borderRadius: 8,
                        padding: '8px 12px',
                        outline: 'none',
                        background: '#fffbeb',
                      }}
                    >
                      <option value="">Select…</option>
                      <option>Single</option>
                      <option>Married</option>
                      <option>Widowed</option>
                      <option>Divorced</option>
                    </select>
                  ) : (
                    <p
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        color: '#1e293b',
                        background: '#f8fafc',
                        padding: '8px 12px',
                        borderRadius: 8,
                      }}
                    >
                      {memberData?.marital_status || '—'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Render: Helpdesk ─────────────────────────────────────────────────────
  const renderHelpdesk = () => (
    <div>
      <div style={S.pageHeader}>
        <h2 style={S.pageTitle}>Contact & Helpdesk</h2>
        <p style={S.pageSubtitle}>Have a question or concern? We're here to help.</p>
      </div>
      {ticketSubmitted ? (
        <div style={{ ...S.panel, textAlign: 'center', padding: '48px 32px' }}>
          <CheckCircle style={{ color: '#22c55e', marginBottom: 16 }} size={48} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: BRAND.darkNavy, marginBottom: 8 }}>
            Message Sent!
          </h3>
          <p style={{ color: '#64748b', marginBottom: 24, fontSize: '0.875rem' }}>
            Your message has been received. Our team will follow up shortly.
          </p>
          <button
            onClick={() => setTicketSubmitted(false)}
            style={{
              background: BRAND.darkNavy,
              color: BRAND.gold,
              border: 'none',
              borderRadius: 10,
              padding: '10px 24px',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Send Another Message
          </button>
        </div>
      ) : (
        <div style={S.panel}>
          <div style={S.panelHeader}>
            <h3 style={S.panelTitle}>Send a Message</h3>
          </div>
          <div style={S.panelBody}>
            <form onSubmit={handleSubmitTicket} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {ticketError && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    borderRadius: 10,
                    padding: '12px 16px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  <AlertCircle size={16} /> {ticketError}
                </div>
              )}
              {[
                { label: 'Department', isSelect: true },
                { label: 'Subject', key: 'subject' },
              ].map(() => null)}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    marginBottom: 8,
                  }}
                >
                  Department
                </label>
                <select
                  value={ticketDepartment}
                  onChange={(e) => setTicketDepartment(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                    outline: 'none',
                    background: '#f8fafc',
                  }}
                >
                  <option>General</option>
                  <option>Finance</option>
                  <option>Membership</option>
                  <option>Prayer</option>
                  <option>Youth</option>
                  <option>Events</option>
                  <option>Welfare</option>
                </select>
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    marginBottom: 8,
                  }}
                >
                  Subject
                </label>
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Brief description of your message"
                  style={{
                    width: '100%',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                    outline: 'none',
                    background: '#f8fafc',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    marginBottom: 8,
                  }}
                >
                  Message
                </label>
                <textarea
                  required
                  value={ticketBody}
                  onChange={(e) => setTicketBody(e.target.value)}
                  rows={5}
                  placeholder="Write your message here…"
                  style={{
                    width: '100%',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: '0.875rem',
                    outline: 'none',
                    background: '#f8fafc',
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={submittingTicket}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: `linear-gradient(135deg, ${BRAND.darkNavy}, ${BRAND.deepPurple})`,
                  color: BRAND.gold,
                  border: 'none',
                  borderRadius: 10,
                  padding: '13px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: submittingTicket ? 0.7 : 1,
                }}
              >
                <MessageSquare size={18} /> {submittingTicket ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return renderDashboard();
      case 'attendance':
        return renderAttendance();
      case 'giving':
        return renderGiving();
      case 'profile':
        return renderProfile();
      case 'helpdesk':
        return renderHelpdesk();
      default:
        return renderDashboard();
    }
  };

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'attendance', label: 'My Attendance', icon: Calendar },
    { key: 'giving', label: 'My Giving', icon: Heart },
    { key: 'profile', label: 'My Profile', icon: User },
    { key: 'helpdesk', label: 'Contact Us', icon: MessageSquare },
  ];

  return (
    <div style={S.root}>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @media (max-width: 768px) {
          .portal-sidebar { display: none !important; }
          .portal-sidebar.open { display: flex !important; position: fixed; inset: 0; z-index: 50; width: 260px !important; }
          .portal-main { padding: 16px !important; }
          .portal-card-grid { grid-template-columns: 1fr !important; }
          .portal-detail-grid { grid-template-columns: 1fr !important; }
          .portal-mobile-header { display: flex !important; }
        }
        .portal-mobile-header { display: none; align-items: center; gap: 12px; background: ${BRAND.darkNavy}; padding: 14px 16px; position: sticky; top: 0; z-index: 10; }
        .portal-nav-btn:hover { background: rgba(212,175,55,0.1) !important; }
      `}</style>

      {/* Mobile Header */}
      <div className="portal-mobile-header">
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          style={{ background: 'none', border: 'none', color: BRAND.gold, cursor: 'pointer' }}
        >
          <Menu size={22} />
        </button>
        <span style={{ color: BRAND.white, fontWeight: 700, fontSize: '0.9rem' }}>HKM Member Portal</span>
      </div>

      {/* Sidebar */}
      <div className={`portal-sidebar${mobileSidebarOpen ? ' open' : ''}`} style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.logoRow}>
            <img src="/hkm-logo.webp" alt="HKM" style={S.logoImg} />
            <span style={S.logoText}>
              Heavenly God
              <br />
              Kingdom Churches
            </span>
          </div>
          <div style={S.goldDivider} />
          {memberData?.avatar ? (
            <img
              src={memberData.avatar}
              alt="Profile"
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                marginBottom: 12,
                border: '2px solid rgba(212, 175, 55, 0.6)',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                marginBottom: 12,
                border: '2px solid rgba(212, 175, 55, 0.6)',
                background: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={24} color="#d4af37" />
            </div>
          )}
          <p style={S.welcomeLabel}>Signed in as</p>
          <p style={S.welcomeName}>{currentUser?.full_name || 'Member'}</p>
          <p style={S.memberId}>{currentUser?.id}</p>
        </div>

        <nav style={S.nav}>
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className="portal-nav-btn"
              onClick={() => {
                setActiveTab(key);
                setMobileSidebarOpen(false);
              }}
              style={getNavStyle(activeTab === key)}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>

        <div style={S.navFooter}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              color: '#f87171',
              textAlign: 'left',
            }}
          >
            <LogOut size={17} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="portal-main" style={S.main}>
        <div className="portal-card-grid" style={S.cardGrid as React.CSSProperties}>
          {/* This wrapper applies responsive styles for stat cards */}
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default MemberDashboard;
