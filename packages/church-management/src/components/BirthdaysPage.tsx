import React, { useState } from 'react';
import { Member } from './memberData';
import { GiftIcon, PhoneIcon, MailIcon } from './Icons';
import { TransformedAvatar } from './AvatarEditor';

const calculateAge = (dob: string) => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const BirthdayCard: React.FC<{ member: Member }> = ({ member }) => {
  const birthDate = new Date(member.dob);
  const day = birthDate.toLocaleDateString('en-US', { day: '2-digit' });
  const month = birthDate.toLocaleDateString('en-US', { month: 'short' });

  return (
    <div className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center text-center transition-transform transform hover:-translate-y-1">
      <TransformedAvatar
        src={member.avatar}
        transform={member.avatarTransform}
        className="w-24 h-24 rounded-full mb-4 border-4 border-gray-100"
        alt={member.name}
      />
      <h3 className="font-bold text-lg text-gray-800 capitalize">{member.name}</h3>
      <p className="text-sm text-gray-500">{member.department}</p>
      <div className="my-3 text-green-600 font-semibold bg-green-50 px-3 py-1 rounded-full">
        {month} {day}
      </div>
      <p className="text-sm text-gray-500 mb-4">Turns {calculateAge(member.dob) + 1}</p>
      <div className="flex space-x-3">
        {member.phone && (
          <a
            href={`tel:${member.phone}`}
            className="p-2 bg-gray-100 rounded-full hover:bg-green-100 text-gray-600 hover:text-green-600"
          >
            <PhoneIcon className="w-5 h-5" />
          </a>
        )}
        {member.email && (
          <a
            href={`mailto:${member.email}`}
            className="p-2 bg-gray-100 rounded-full hover:bg-green-100 text-gray-600 hover:text-green-600"
          >
            <MailIcon className="w-5 h-5" />
          </a>
        )}
      </div>
    </div>
  );
};

const BirthdaysPage: React.FC<{ members: Member[] }> = ({ members }) => {
  const [activeTab, setActiveTab] = useState<'thisMonth' | 'upcoming'>('thisMonth');

  const now = new Date();
  const currentMonth = now.getMonth();
  const nextMonth = (currentMonth + 1) % 12;

  const birthdaysThisMonth = members
    .filter((m) => m.dob && new Date(m.dob).getMonth() === currentMonth)
    .sort((a, b) => new Date(a.dob).getDate() - new Date(b.dob).getDate());

  const birthdaysUpcoming = members
    .filter((m) => m.dob && new Date(m.dob).getMonth() === nextMonth)
    .sort((a, b) => new Date(a.dob).getDate() - new Date(b.dob).getDate());

  const currentMonthName = now.toLocaleString('default', { month: 'long' });
  const nextMonthName = new Date(now.getFullYear(), nextMonth, 1).toLocaleString('default', { month: 'long' });

  const displayedBirthdays = activeTab === 'thisMonth' ? birthdaysThisMonth : birthdaysUpcoming;
  const displayedMonthName = activeTab === 'thisMonth' ? currentMonthName : nextMonthName;

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg bg-gradient-to-r from-purple-50 to-pink-100 text-gray-800 shadow">
        <div className="flex items-center">
          <GiftIcon className="h-8 w-8 mr-3 text-pink-500" />
          <div>
            <h1 className="text-3xl font-bold">Member Birthdays</h1>
            <p className="mt-1 text-gray-600">Celebrate with members on their special day.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setActiveTab('thisMonth')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'thisMonth' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              This Month ({birthdaysThisMonth.length})
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'upcoming' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              Upcoming ({birthdaysUpcoming.length})
            </button>
          </nav>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">{displayedMonthName} Birthdays</h2>
        {displayedBirthdays.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {displayedBirthdays.map((member) => (
              <BirthdayCard key={member.id} member={member} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500">No birthdays in {displayedMonthName}.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BirthdaysPage;
