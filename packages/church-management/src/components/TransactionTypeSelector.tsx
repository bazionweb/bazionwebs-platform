import React from 'react';
import { DollarSign } from 'lucide-react';

interface TransactionTypeSelectorProps {
  type: 'Income' | 'Expense';
  setType: (type: 'Income' | 'Expense') => void;
  disabled?: boolean;
}

export const TransactionTypeSelector: React.FC<TransactionTypeSelectorProps> = ({
  type,
  setType,
  disabled = false,
}) => {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
        Transaction Type
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setType('Income')}
          style={{
            padding: '12px',
            borderRadius: '8px',
            border: type === 'Income' ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
            backgroundColor: type === 'Income' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.03)',
            color: '#fff',
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <DollarSign style={{ width: '18px', height: '18px', color: '#22c55e' }} />
          Income (Credit)
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setType('Expense')}
          style={{
            padding: '12px',
            borderRadius: '8px',
            border: type === 'Expense' ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
            backgroundColor: type === 'Expense' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.03)',
            color: '#fff',
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <DollarSign style={{ width: '18px', height: '18px', color: '#ef4444' }} />
          Expense (Debit)
        </button>
      </div>
    </div>
  );
};

export default TransactionTypeSelector;
