import React, { useRef } from 'react';
import { DownloadIcon, UploadIcon, ExclamationIcon } from './Icons';
import { storage } from '../services/storage';

const DatabaseManagement: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    try {
      const backupData = await storage.exportBackup();

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      const date = new Date().toISOString().split('T')[0];
      link.download = `hkm_backup_${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);

      alert('Backup download has started.');
    } catch (error) {
      console.error('Error creating backup:', error);
      alert('An error occurred while creating the backup file.');
    }
  };

  const handleRestoreChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      !window.confirm(
        'Are you sure you want to restore from this backup? This will overwrite ALL current data in the application. This action cannot be undone.',
      )
    ) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('Invalid file content');

        const backupData = JSON.parse(text);
        await storage.importBackup(backupData);

        alert('Data restored successfully. The application will now reload.');
        window.location.reload();
      } catch (error) {
        console.error('Error restoring data:', error);
        alert('Restore failed. The selected file is not a valid backup file.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = async () => {
    if (
      window.confirm(
        'DANGER: Are you absolutely sure? This will permanently delete ALL data including members, finances, and users. This action cannot be undone.',
      )
    ) {
      try {
        await storage.clearAll();
      } catch (error) {
        console.error('Error resetting data:', error);
        alert('An error occurred while resetting the data.');
      }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <h2 className="text-xl font-semibold text-gray-700">Database Management</h2>

      <div className="p-5 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <DownloadIcon className="h-5 w-5 mr-2 text-gray-500" />
          Backup Data
        </h3>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Export all your application data (members, finances, attendance, settings) into a single JSON file. Keep this
          file in a safe place.
        </p>
        <button
          onClick={handleBackup}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center shadow transition duration-300"
        >
          <DownloadIcon className="h-5 w-5 mr-2" />
          Export & Download Backup
        </button>
      </div>

      <div className="p-5 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <UploadIcon className="h-5 w-5 mr-2 text-gray-500" />
          Restore from Backup
        </h3>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          Restore application data from a previously downloaded backup file.
          <span className="font-semibold text-red-600"> This will overwrite all current data.</span>
        </p>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleRestoreChange}
          accept=".json"
          className="hidden"
          id="restore-file-input"
        />
        <label
          htmlFor="restore-file-input"
          className="cursor-pointer bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center shadow transition duration-300"
        >
          <UploadIcon className="h-5 w-5 mr-2" />
          Choose Backup File
        </label>
      </div>

      <div className="p-5 border-2 border-red-300 rounded-lg bg-red-50">
        <h3 className="text-lg font-semibold text-red-800 flex items-center">
          <ExclamationIcon className="h-5 w-5 mr-2" />
          Danger Zone
        </h3>
        <p className="text-sm text-red-600 mt-1 mb-4">
          This action is irreversible. Resetting will permanently delete all church data and restore the application to
          its initial state.
        </p>
        <button
          onClick={handleResetData}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center shadow transition duration-300"
        >
          Reset Application Data
        </button>
      </div>
    </div>
  );
};

export default DatabaseManagement;
