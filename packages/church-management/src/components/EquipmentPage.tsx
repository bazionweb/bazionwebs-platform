import React, { useState } from 'react';
import { Equipment } from './equipmentData';
import { MaintenanceRecord } from './maintenanceData';
import EquipmentDashboard from './EquipmentDashboard';
import EquipmentInventoryPage from './EquipmentInventoryPage';
import MaintenancePage from './MaintenancePage';
import EquipmentReportsPage from './EquipmentReportsPage';

interface EquipmentPageProps {
  setActivePage: (page: string) => void;
  equipment: Equipment[];
  onEdit: (item: Equipment) => void;
  onDelete: (id: number) => void;
  maintenanceRecords: MaintenanceRecord[];
  onEditMaintenance: (record: MaintenanceRecord) => void;
  onDeleteMaintenance: (id: number) => void;
}

const EquipmentPage: React.FC<EquipmentPageProps> = ({
  setActivePage,
  equipment,
  onEdit,
  onDelete,
  maintenanceRecords,
  onEditMaintenance,
  onDeleteMaintenance,
}) => {
  const [activeView, setActiveView] = useState<'Dashboard' | 'Inventory' | 'Maintenance' | 'Reports'>('Dashboard');

  const renderView = () => {
    switch (activeView) {
      case 'Dashboard':
        return (
          <EquipmentDashboard
            setActivePage={setActivePage}
            equipment={equipment}
            onEdit={onEdit}
            onDelete={onDelete}
            setActiveView={setActiveView}
          />
        );
      case 'Inventory':
        return (
          <EquipmentInventoryPage
            equipment={equipment}
            onEdit={onEdit}
            onDelete={onDelete}
            setActivePage={setActivePage}
            onBack={() => setActiveView('Dashboard')}
          />
        );
      case 'Maintenance':
        return (
          <MaintenancePage
            onBack={() => setActiveView('Dashboard')}
            setActivePage={setActivePage}
            equipment={equipment}
            maintenanceRecords={maintenanceRecords}
            onEdit={onEditMaintenance}
            onDelete={onDeleteMaintenance}
          />
        );
      case 'Reports':
        return <EquipmentReportsPage equipment={equipment} onBack={() => setActiveView('Dashboard')} />;
      default:
        return (
          <EquipmentDashboard
            setActivePage={setActivePage}
            equipment={equipment}
            onEdit={onEdit}
            onDelete={onDelete}
            setActiveView={setActiveView}
          />
        );
    }
  };

  return <div>{renderView()}</div>;
};

export default EquipmentPage;
