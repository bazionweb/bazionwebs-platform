import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon } from './Icons';
import { InputField, SelectField, TextAreaField } from './FormControls';
import { Member } from './memberData';
import { Transaction, IncomeCategory, ExpenseCategory } from './financeData';
import TransactionConfirmModal, { PendingTransaction } from './transaction/TransactionConfirmModal';
import RegistrationFeeStatus from './transaction/RegistrationFeeStatus';

interface AddTransactionPageProps {
  onBack: () => void;
  onSave: (transaction: Omit<Transaction, 'id'> | Transaction) => void;
  transactionToEdit: Transaction | null;
  members: Member[];
  transactions?: Transaction[];
}

const incomeCategories: IncomeCategory[] = [
  'Tithe',
  'Offering',
  'Project Offering',
  'Pledge',
  'Seed',
  "Pastor's Appreciation",
  'Welfare',
  'Children Service Offering',
  'Donation',
  'Church Bills Contribution',
  'Registration Fee',
  'Others',
];
const expenseCategories: ExpenseCategory[] = [
  'Utilities',
  'Rent',
  'Salaries',
  'Supplies',
  'Events',
  'Maintenance',
  'Outreach',
  'Honorarium',
  'Others',
];
const memberRequiredCategories: IncomeCategory[] = [
  'Tithe',
  'Welfare',
  'Pledge',
  'Seed',
  "Pastor's Appreciation",
  'Church Bills Contribution',
  'Registration Fee',
];

const AddTransactionPage: React.FC<AddTransactionPageProps> = ({
  onBack,
  onSave,
  transactionToEdit,
  members,
  transactions,
}) => {
  const isEditMode = !!transactionToEdit;

  const [type, setType] = useState<'Income' | 'Expense'>('Income');
  const [category, setCategory] = useState<IncomeCategory | ExpenseCategory>('Tithe');
  const [memberId, setMemberId] = useState<string>('');

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isNonMember, setIsNonMember] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [nonMemberName, setNonMemberName] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingTransactionData, setPendingTransactionData] = useState<PendingTransaction | null>(null);

  useEffect(() => {
    if (isEditMode && transactionToEdit) {
      setType(transactionToEdit.type);
      setCategory(transactionToEdit.category);
      setMemberId(transactionToEdit.memberId || '');
      setAmount(transactionToEdit.amount.toString());
      setDate(transactionToEdit.date);
      setDescription(transactionToEdit.description);
      setIsNonMember(!!transactionToEdit.nonMemberName);
      setIsAnonymous(!!transactionToEdit.isAnonymous);
      setNonMemberName(transactionToEdit.nonMemberName || '');

      console.warn('Edit mode - loaded transaction with memberId:', transactionToEdit.memberId);
    } else {
      // Reset form when not in edit mode
      console.warn('Form reset - clearing memberId');
      setMemberId('');
    }
  }, [transactionToEdit, isEditMode]);

  useEffect(() => {
    if (isNonMember) {
      setMemberId('');
      setIsAnonymous(false);
    }
  }, [isNonMember]);

  useEffect(() => {
    if (isAnonymous) {
      setMemberId('');
      setNonMemberName('');
    }
  }, [isAnonymous]);

  useEffect(() => {
    if (type === 'Expense') {
      setIsNonMember(false);
      setIsAnonymous(false);
      setNonMemberName('');
      setMemberId('');
    }
  }, [type]);

  // Registration Fee requires a member — auto-clear non-member toggle
  useEffect(() => {
    if (category === 'Registration Fee') {
      setIsNonMember(false);
      setIsAnonymous(false);
      setNonMemberName('');
    }
  }, [category]);

  // Auto-clear category if fully registered member is selected
  useEffect(() => {
    if (memberId && category === 'Registration Fee') {
      const selectedMember = members.find((m) => m.id === memberId);
      if (selectedMember && (selectedMember.status === 'Active' || selectedMember.status === 'Transferred')) {
        setCategory('Tithe');
      }
    }
  }, [memberId, category, members]);

  const disabledIncomeCategories: IncomeCategory[] = [];
  const selectedMemberObj = members.find((m) => m.id === memberId);
  if (selectedMemberObj && (selectedMemberObj.status === 'Active' || selectedMemberObj.status === 'Transferred')) {
    disabledIncomeCategories.push('Registration Fee');
  }

  const isPendingFee = selectedMemberObj?.status === 'Pending Fee';
  const registrationThreshold = 500;
  const pastRegistrationFees =
    transactions && memberId
      ? transactions
          .filter((t) => t.memberId === memberId && t.category === 'Registration Fee')
          .reduce((sum, t) => sum + t.amount, 0)
      : 0;
  const currentAmount = parseFloat(amount) || 0;
  const projectedTotal = pastRegistrationFees + currentAmount;
  const thresholdMetOnSave = projectedTotal >= registrationThreshold;
  const hasEmail = !!selectedMemberObj?.email;
  const hasPhone = !!selectedMemberObj?.phone;
  const hasContact = hasEmail || hasPhone;
  const missingContactFields: string[] = [];
  if (!hasEmail) missingContactFields.push('Email');
  if (!hasPhone) missingContactFields.push('Phone');
  const isSaveDisabled = thresholdMetOnSave && isPendingFee && !hasContact;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !amount || !date) {
      alert('Please fill in all required fields.');
      return;
    }

    if (category === 'Welfare' && (!description || !description.trim())) {
      alert('Please provide a reason for the welfare contribution.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    const isMemberRequired =
      type === 'Income' &&
      !isNonMember &&
      !isAnonymous &&
      memberRequiredCategories.includes(category as IncomeCategory);
    if (isMemberRequired && !memberId) {
      alert('Please select a member for this transaction category.');
      return;
    }

    const transactionData = {
      type,
      category,
      amount: parsedAmount,
      date,
      description,
      memberId: type === 'Income' && !isNonMember && !isAnonymous && memberId ? memberId : undefined,
      nonMemberName: type === 'Income' && isNonMember && nonMemberName ? nonMemberName.trim() : undefined,
      isAnonymous: type === 'Income' && isAnonymous ? true : undefined,
    };

    // Block save if registration threshold met but contact info missing
    if (isSaveDisabled) {
      alert(
        `Cannot Activate: Threshold met but ${missingContactFields.join(' and ')} is missing. Update the member's profile with ${missingContactFields.join(' and ')} before saving.`,
      );
      return;
    }

    // Store the transaction data and show confirmation
    if (isEditMode) {
      setPendingTransactionData({ ...transactionData, id: transactionToEdit!.id });
    } else {
      setPendingTransactionData(transactionData);
    }
    setShowConfirmation(true);
  };

  const handleConfirmSave = async () => {
    if (pendingTransactionData) {
      setIsSubmitting(true);
      try {
        await onSave(pendingTransactionData);
      } catch (err) {
        console.error('[Save] onSave failed:', err);
      } finally {
        setIsSubmitting(false);
        setShowConfirmation(false);
        setPendingTransactionData(null);
      }
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setPendingTransactionData(null);
  };

  // Create member options - include all members from database
  // The useMembers hook should now provide fallback names for members without proper names
  const validMembers = members.filter((m) => {
    // Very minimal filtering - just ensure we have some kind of name
    const hasName = m.name && typeof m.name === 'string' && m.name.trim().length > 0;
    return hasName;
  });

  // Check for duplicate names and handle them
  const memberCounts = validMembers.reduce(
    (acc, member) => {
      acc[member.name] = (acc[member.name] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Add ID suffix for members with duplicate names to make them unique
  const memberOptions = validMembers.map((m) => {
    if (memberCounts[m.name] > 1) {
      return `${m.name} (${m.id})`;
    }
    return m.name;
  });

  return (
    <div>
      <div className="p-6 rounded-lg bg-white shadow-sm border mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{isEditMode ? 'Edit' : 'Add'} Financial Transaction</h1>
            <p className="mt-1 text-gray-600">
              Fill in the form below to {isEditMode ? 'update the' : 'record a new'} transaction.
            </p>
          </div>
          <button
            onClick={onBack}
            className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 flex items-center"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" /> Back to Finances
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
            <div className="flex bg-gray-200 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setType('Income');
                  setCategory('Tithe');
                }}
                className={`w-full py-2 rounded-md font-semibold ${type === 'Income' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('Expense');
                  setCategory('Utilities');
                  setMemberId('');
                }}
                className={`w-full py-2 rounded-md font-semibold ${type === 'Expense' ? 'bg-white shadow' : 'text-gray-600'}`}
              >
                Expense
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SelectField
              name="category"
              label={`${type} Category`}
              options={type === 'Income' ? incomeCategories : expenseCategories}
              disabledOptions={type === 'Income' ? disabledIncomeCategories : []}
              value={category}
              onChange={(e) => setCategory(e.target.value as IncomeCategory | ExpenseCategory)}
              required
            />

            {type === 'Income' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contributor</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNonMember(false);
                      setIsAnonymous(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium border transition-colors ${
                      !isNonMember && !isAnonymous
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Member
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNonMember(true);
                      setIsAnonymous(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium border transition-colors ${
                      isNonMember
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    } ${category === 'Registration Fee' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={category === 'Registration Fee'}
                  >
                    Non-Member
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAnonymous(true);
                      setIsNonMember(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium border transition-colors ${
                      isAnonymous
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    } ${category === 'Registration Fee' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={category === 'Registration Fee'}
                  >
                    Anonymous
                  </button>
                </div>

                {isAnonymous ? (
                  <div className="p-3 border border-purple-200 rounded-lg bg-purple-50">
                    <p className="text-sm text-purple-700">
                      <span className="font-medium">Anonymous Gift</span> — The contributor&apos;s identity will not be
                      recorded.
                    </p>
                  </div>
                ) : isNonMember ? (
                  <InputField
                    name="nonMemberName"
                    label="Non-Member Name"
                    type="text"
                    value={nonMemberName}
                    onChange={(e) => setNonMemberName(e.target.value)}
                    required
                  />
                ) : (
                  <>
                    {validMembers.length === 0 ? (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Member <span className="text-red-500">*</span>
                        </label>
                        <div className="p-3 border border-orange-300 rounded-lg bg-orange-50">
                          <p className="text-sm text-orange-700">
                            No active members with valid data found. Please ensure members have both names and email
                            addresses, or use the "Non-Member" or "Anonymous" option above.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <SelectField
                          name="member"
                          label="Member"
                          options={memberOptions}
                          value={(() => {
                            if (!memberId) return '';
                            const member = validMembers.find((m) => m.id === memberId);
                            if (!member) return '';
                            if (memberCounts[member.name] > 1) return `${member.name} (${member.id})`;
                            return member.name;
                          })()}
                          onChange={(e) => {
                            let selectedMember;
                            if (e.target.value.includes(' (') && e.target.value.endsWith(')')) {
                              const idMatch = e.target.value.match(/\(([^)]+)\)$/);
                              const id = idMatch ? idMatch[1] : '';
                              selectedMember = validMembers.find((m) => m.id === id);
                            } else {
                              selectedMember = validMembers.find((m) => m.name === e.target.value);
                            }
                            const newMemberId = selectedMember ? selectedMember.id : '';
                            setMemberId(newMemberId);
                          }}
                          required={memberRequiredCategories.includes(category as IncomeCategory)}
                        />
                        {category === 'Registration Fee' && memberId && (
                          <RegistrationFeeStatus
                            pastRegistrationFees={pastRegistrationFees}
                            registrationThreshold={registrationThreshold}
                            currentAmount={currentAmount}
                            projectedTotal={projectedTotal}
                            missingContactFields={missingContactFields}
                            hasContact={hasContact}
                            thresholdMetOnSave={thresholdMetOnSave}
                            isPendingFee={isPendingFee}
                          />
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div />
            )}

            <InputField
              name="amount"
              label="Amount (KSH)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <InputField
              name="date"
              label="Transaction Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {category === 'Welfare' ? (
            <TextAreaField
              label="Reason for Welfare"
              placeholder="Required: Please enter the specific reason for this welfare contribution..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          ) : (
            <TextAreaField
              label="Description"
              placeholder="Optional notes about the transaction"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}

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
              disabled={isSaveDisabled}
              className={`bg-church-green-dark text-white font-semibold py-2 px-6 rounded-lg ${
                isSaveDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700'
              }`}
            >
              {isEditMode ? 'Update' : 'Save'} Transaction
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && pendingTransactionData && (
        <TransactionConfirmModal
          pendingTransactionData={pendingTransactionData}
          isEditMode={isEditMode}
          isSubmitting={isSubmitting}
          validMembers={validMembers}
          onConfirm={handleConfirmSave}
          onCancel={handleCancelConfirmation}
        />
      )}
    </div>
  );
};

export default AddTransactionPage;
