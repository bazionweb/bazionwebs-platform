export type EquipmentCondition = 'Excellent' | 'Good' | 'Fair' | 'Needs Attention';

export interface Equipment {
  id: number;
  name: string;
  category: string;
  purchaseDate?: string;
  purchasePrice?: number;
  condition: EquipmentCondition;
  location?: string;
  description?: string;
}

export const initialEquipment: Equipment[] = [
  {
    id: 1,
    name: 'Yamaha Keyboard',
    category: 'Musical Instrument',
    purchaseDate: '2022-01-15',
    purchasePrice: 2500,
    condition: 'Excellent',
    location: 'Main Auditorium',
    description: 'Primary keyboard for services.',
  },
  {
    id: 2,
    name: 'Shure SM58 Microphone',
    category: 'Sound',
    purchaseDate: '2021-11-20',
    purchasePrice: 150,
    condition: 'Good',
    location: 'Storage Room',
    description: 'Vocal microphone.',
  },
  {
    id: 3,
    name: 'Canon EOS R Camera',
    category: 'Camera',
    purchaseDate: '2023-03-10',
    purchasePrice: 1800,
    condition: 'Excellent',
    location: 'Media Booth',
    description: 'Main camera for live streaming.',
  },
  {
    id: 4,
    name: 'Drum Set',
    category: 'Musical Instrument',
    purchaseDate: '2020-05-01',
    purchasePrice: 1200,
    condition: 'Good',
    location: 'Main Auditorium',
    description: '5-piece drum kit.',
  },
  {
    id: 5,
    name: 'Projector',
    category: 'Visuals',
    purchaseDate: '2019-08-25',
    purchasePrice: 800,
    condition: 'Needs Attention',
    location: 'Main Auditorium',
    description: 'Lamp is getting dim, needs replacement soon.',
  },
];

export const equipmentCategories = ['Sound', 'Musical Instrument', 'Camera', 'Visuals', 'Lighting', 'Office', 'Other'];
