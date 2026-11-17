import React from 'react';
import { UserRole, AccessibleSection, PermissionLevel } from './userData';
import { Settings2, CheckCircle, XCircle } from 'lucide-react';

interface UserRoleSelectorProps {
  role: UserRole;
  setRole: (role: UserRole) => void;
  allowedSections: AccessibleSection[];
  sectionPermissions: Record<AccessibleSection, PermissionLevel>;
  onSectionToggle: (section: AccessibleSection) => void;
  onPermissionLevelChange: (section: AccessibleSection, level: PermissionLevel) => void;
  allAccessibleSections: AccessibleSection[];
  rolePresets: Record<UserRole, { label: string; description: string; sections: AccessibleSection[] }>;
}

export const UserRoleSelector: React.FC<UserRoleSelectorProps> = ({
  role,
  setRole,
  allowedSections,
  sectionPermissions,
  onSectionToggle,
  onPermissionLevelChange,
  allAccessibleSections,
  rolePresets,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
          User Role & Permissions
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {(Object.keys(rolePresets) as UserRole[]).map((r) => {
            const isSelected = role === r;
            const preset = rolePresets[r];
            return (
              <div
                key={r}
                onClick={() => setRole(r)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: isSelected ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{preset.label}</span>
                  {isSelected ? (
                    <CheckCircle style={{ width: '18px', height: '18px', color: '#22c55e' }} />
                  ) : (
                    <XCircle style={{ width: '18px', height: '18px', color: 'rgba(255,255,255,0.3)' }} />
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.75, lineHeight: 1.3 }}>{preset.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Settings2 style={{ width: '18px', height: '18px', color: '#22c55e' }} />
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Granular Section Permissions</h4>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {allAccessibleSections.map((section) => {
            const isAllowed = allowedSections.includes(section);
            const level = sectionPermissions[section] || 'view';
            return (
              <div
                key={section}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: isAllowed ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  <input
                    type="checkbox"
                    checked={isAllowed}
                    onChange={() => onSectionToggle(section)}
                    style={{ accentColor: '#22c55e' }}
                  />
                  <span>{section}</span>
                </label>
                {isAllowed && (
                  <select
                    value={level}
                    onChange={(e) => onPermissionLevelChange(section, e.target.value as PermissionLevel)}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    <option value="view">View Only</option>
                    <option value="edit">Edit</option>
                    <option value="full">Full Control</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UserRoleSelector;
