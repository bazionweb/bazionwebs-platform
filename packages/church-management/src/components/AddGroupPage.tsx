import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, CollectionIcon } from './Icons';
import { InputField, SelectField, TextAreaField } from './FormControls';
import { Member, AgeGroup } from './memberData';
import { Group } from './GroupsManagementPage';

interface AddGroupPageProps {
  onBack: () => void;
  members: Member[];
  onSave: (groupData: Partial<Group>) => void;
  groupToEdit: Group | null;
}

const AddGroupPage: React.FC<AddGroupPageProps> = ({ onBack, members, onSave, groupToEdit }) => {
  const isEditMode = !!groupToEdit;
  const [groupName, setGroupName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [category, setCategory] = useState<AgeGroup | 'General'>('General');

  useEffect(() => {
    if (isEditMode && groupToEdit) {
      setGroupName(groupToEdit.name);
      const leader = members.find((m) => m.email === groupToEdit.leader);
      if (leader) {
        setLeaderName(leader.name);
      }
      setCategory(groupToEdit.category || 'General');
    }
  }, [isEditMode, groupToEdit, members]);

  const memberNames = members.map((m) => m.name);
  const categoryOptions: (AgeGroup | 'General')[] = ['Children/Sunday School', 'Junior Youth', 'Youth', 'General'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || !leaderName) {
      alert('Please fill out all required fields.');
      return;
    }
    const leader = members.find((m) => m.name === leaderName);
    if (!leader) {
      alert('Selected leader is not a valid member.');
      return;
    }

    const dataToSave: Partial<Group> = {
      name: groupName,
      leader: leader.email,
      category: category,
    };

    if (isEditMode && groupToEdit) {
      dataToSave.id = groupToEdit.id;
    }

    onSave(dataToSave);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit Group' : 'Add New Group'}</h1>
        <button onClick={onBack} className="flex items-center text-sm text-green-600 hover:underline font-semibold">
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Groups
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <p className="flex items-center text-green-700 font-medium">
            <CollectionIcon className="h-6 w-6 mr-2 p-1 bg-green-100 rounded-full" />
            Please fill in the group details below
          </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <InputField
            name="groupName"
            label="Group Name"
            type="text"
            placeholder="e.g., Sunday School Class A, Junior Youth Group 1"
            required
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <SelectField
            name="groupCategory"
            label="Group Category"
            options={categoryOptions}
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as AgeGroup | 'General')}
          />
          <SelectField
            name="groupLeader"
            label="Group Leader"
            options={memberNames}
            required
            value={leaderName}
            onChange={(e) => setLeaderName(e.target.value)}
          />
          <TextAreaField label="Group Description" placeholder="Briefly describe the purpose of this group." />

          <div className="flex justify-end pt-6 border-t">
            <button
              type="button"
              onClick={onBack}
              className="bg-gray-200 text-gray-700 font-semibold py-2 px-6 rounded-lg mr-4 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-church-green-dark hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg"
            >
              {isEditMode ? 'Update Group' : 'Save Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGroupPage;
