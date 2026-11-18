import React, { useState, useEffect } from 'react';
import { X, UserPlus, Upload, User, CheckCircle2, Loader2, Crop as CropIcon } from '../shims/lucide-react';
import ReactCrop, { type Crop, type PixelCrop } from '../shims/react-image-crop';
import { Student } from '../types';
import { createStudent, updateStudent } from '../services/studentService';
import { authFetch } from '../services/authService';
import { getAllStudyCenters, StudyCenter } from "../services/studyCenterService";
import { API_URL } from '../services/config';
import { StudyCenterSelector } from './StudyCenterSelector';
import { useTranslation } from '../shims/react-i18next';

interface Program {
  id: string;
  program_code: string;
  name: string;
  degree_level: string;
}

interface StudentRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (studentData: Student) => void;
  initialData?: Student;
}

const StudentRegistrationModal: React.FC<StudentRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData
}) => {
  const { t } = useTranslation();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [, setCampuses] = useState<StudyCenter[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  const [formData, setFormData] = useState<Partial<Student>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    program_code: '',
    status: 'Applicant',
    gender: 'Male',
    admission_date: new Date().toISOString().split('T')[0],
    avatar_color: 'bg-purple-600',
    photo_zoom: 1,
    study_center_id: ''
  });
  
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(undefined);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch programs from the catalog API
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    
    async function loadData() {
      setLoadingPrograms(true);
      try {
        const [programsRes, centers] = await Promise.all([
          authFetch(`${API_URL}/education/catalog/programs`, {}, 5000).then(r => r.json()),
          getAllStudyCenters()
        ]);
        
        if (!cancelled) {
          if (programsRes.success && programsRes.data) {
            setPrograms(programsRes.data);
            if (!formData.program_code && programsRes.data.length > 0) {
              setFormData(prev => ({ ...prev, program_code: programsRes.data![0].id }));
            }
          }
          setCampuses(centers);
        }
      } catch { // Handle error
       } finally {
        if (!cancelled) setLoadingPrograms(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setPhotoPreview(initialData.photo);
    } else if (isOpen) {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        program_code: programs.length > 0 ? programs[0].id : '',
        status: 'Applicant',
        gender: 'Male',
        admission_date: new Date().toISOString().split('T')[0],
        avatar_color: 'bg-purple-600',
        photo_zoom: 1,
        study_center_id: ''
      });
      setPhotoPreview(undefined);
      setError(null);
    }
  }, [initialData, isOpen]);

  const handleChange = (field: keyof Student, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const finalizeCrop = () => {
    if (!completedCrop || !imgRef.current || completedCrop.width <= 0 || completedCrop.height <= 0) {
      setIsCropping(false);
      return;
    }
    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    const base64Image = canvas.toDataURL('image/jpeg');
    setPhotoPreview(base64Image);
    handleChange('photo', base64Image);
    setIsCropping(false);
  };

  const handleSubmit = async () => {
    // Validate required fields (only First Name and Last Name are required)
    if (!formData.first_name || !formData.last_name) {
      setError('Please fill in all required fields (First Name, Last Name)');
      return;
    }

    if (!formData.program_code) {
      setError('Please select an academic program');
      return;
    }

    // Validate email format only if provided
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    // Validate phone format only if provided (at least 10 digits)
    if (formData.phone && formData.phone.trim()) {
      const phoneDigits = formData.phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        setError('Please enter a valid phone number (at least 10 digits)');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let result;
      
      const payload: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || undefined,
        gender: formData.gender,
        date_of_birth: formData.date_of_birth || undefined,
        nationality: formData.nationality || undefined,
        admission_date: formData.admission_date,
        // NOTE: 'program' is NOT sent on update — backend manages it via student_programs table
        status: formData.status,
        avatar_color: formData.avatar_color,
      };

      // Include photo if one was set (cropped or existing)
      if (formData.photo) {
        payload.photo = formData.photo;
      }

      if (formData.study_center_id) {
        payload.study_center_id = String(formData.study_center_id);
      }
      if (formData.gpa !== undefined && formData.gpa !== null) {
        payload.gpa = String(formData.gpa);
      }
      if (formData.year_of_study !== undefined && formData.year_of_study !== null) {
        payload.year_of_study = String(formData.year_of_study);
      }
      if (formData.degree_level) {
        payload.degree_level = formData.degree_level;
      }
      if (formData.graduation_date) {
        payload.graduation_date = formData.graduation_date;
      }

      if (initialData) {
        result = await updateStudent(initialData.id, payload);
      } else {
        result = await createStudent(payload);
      }

      if (result.success && result.data) {
        onSuccess(result.data);
        onClose();
      } else {
        let errMsg = 'Failed to save student. Please try again.';
        if (result.error) {
          if (typeof result.error === 'string') {
            errMsg = result.error;
          } else if (typeof result.error === 'object') {
            const errObj = result.error as any;
            if (errObj.issues && Array.isArray(errObj.issues)) {
              errMsg = (errObj.issues as Array<any>).map((i) => `${(i.path as string[]).join('.')}: ${i.message}`).join(', ');
            } else if (errObj.message) {
              errMsg = errObj.message;
            } else {
              errMsg = JSON.stringify(result.error);
            }
          }
        }
        setError(errMsg);
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'An unexpected error occurred');
     } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#1a0033]/90 backdrop-blur-3xl p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[90vh] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col border-[1px] border-[#FFD700]/30 overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="bg-gray-900 p-8 border-b-2 border-[#FFD700] flex justify-between items-center text-white flex-shrink-0">
           <div className="flex items-center gap-4">
              <div className="p-2 bg-[#FFD700] rounded-none shadow-lg">
                 <UserPlus size={24} className="text-black" />
              </div>
              <div>
                 <h3 className="text-xl font-bold uppercase tracking-tight">{initialData ? 'Update Student Record' : 'New Student Admission'}</h3>
                 <p className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest mt-1">BMI Institutional Enrollment Node</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-red-500 transition-all text-white"><X size={24}/></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-10 bg-[#FAFAFA] dark:bg-gray-950 no-scrollbar space-y-8">
           
           {/* Section A: Bio & Photo */}
           <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-shrink-0 w-full md:w-auto flex justify-center">
                 <div className="w-32 h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center relative overflow-hidden group">
                    {photoPreview ? (
                      <img src={photoPreview} className="w-full h-full object-cover" alt="Student" />
                    ) : (
                      <>
                        <User size={32} className="text-gray-400 mb-2" />
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Upload Photo</span>
                      </>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                       <Upload size={20} className="text-white" />
                    </div>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                 </div>
              </div>

              {/* Crop Modal Overlay */}
              {isCropping && photoPreview && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6">
                  <div className="bg-white dark:bg-gray-900 p-6 max-w-lg w-full flex flex-col shadow-2xl relative">
                    <h4 className="text-lg font-black uppercase mb-4 text-[#4B0082] dark:text-[#FFD700] flex items-center gap-2">
                      <CropIcon size={20} /> Adjust Photo
                    </h4>
                    <div className="relative flex justify-center bg-gray-100 dark:bg-gray-800 overflow-hidden max-h-[50vh]">
                      <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={1}
                        circularCrop
                      >
                        <img
                          ref={imgRef}
                          src={photoPreview}
                          alt="Crop me"
                          className="max-h-[50vh] object-contain"
                          onLoad={(e) => {
                            const { width, height } = e.currentTarget;
                            const size = Math.min(width, height) * 0.8;
                            const x = (width - size) / 2;
                            const y = (height - size) / 2;
                            setCrop({ unit: 'px', x, y, width: size, height: size });
                          }}
                        />
                      </ReactCrop>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        onClick={() => setIsCropping(false)}
                        className="px-6 py-2 border-2 border-gray-300 dark:border-gray-600 text-xs font-bold uppercase hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={finalizeCrop}
                        className="px-6 py-2 bg-[#4B0082] text-white text-xs font-bold uppercase hover:bg-black transition-colors"
                      >
                        Crop & Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">First Name *</label>
                    <input 
                      type="text" 
                      value={formData.first_name} 
                      onChange={(e) => handleChange('first_name', e.target.value)}
                      className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none font-bold text-sm focus:border-[#4B0082]"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Last Name *</label>
                    <input 
                      type="text" 
                      value={formData.last_name} 
                      onChange={(e) => handleChange('last_name', e.target.value)}
                      className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none font-bold text-sm focus:border-[#4B0082]"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Gender</label>
                    <select 
                      value={formData.gender} 
                      onChange={(e) => handleChange('gender', e.target.value)}
                      className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none font-bold text-xs uppercase cursor-pointer"
                    >
                       <option value="Male">Male</option>
                       <option value="Female">Female</option>
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Admission Status</label>
                    <select 
                      value={formData.status} 
                      onChange={(e) => handleChange('status', e.target.value)}
                      className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none font-bold text-xs uppercase cursor-pointer"
                    >
                       {['Active', 'Applicant', 'On Leave', 'Graduated', 'Suspended'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                 </div>
              </div>
           </div>

           <div className="h-[1px] bg-gray-200 dark:bg-gray-800 w-full"></div>

           {/* Section B: Contact */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                 <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Email Address <span className="text-gray-400">(Optional)</span></label>
                 <input 
                   type="email" 
                   value={formData.email} 
                   onChange={(e) => handleChange('email', e.target.value)}
                   className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none font-medium text-sm focus:border-[#4B0082]"
                   placeholder="student@example.com"
                 />
              </div>
              <div className="space-y-1">
                 <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">Phone Number <span className="text-gray-400">(Optional)</span></label>
                 <input 
                   type="text" 
                   value={formData.phone} 
                   onChange={(e) => handleChange('phone', e.target.value)}
                   className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none font-medium text-sm focus:border-[#4B0082]"
                   placeholder="+254 700 000 000"
                 />
              </div>
           </div>

           {/* Section C: Academic */}
           <div className="bg-purple-50/50 dark:bg-purple-900/10 p-6 border border-purple-100 dark:border-purple-900/30 space-y-6">
              <h4 className="text-[10px] font-black uppercase text-[#4B0082] dark:text-purple-300 tracking-[0.25em]">Academic Placement</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1 md:col-span-2">
                    <label className="text-[9px] font-bold uppercase text-gray-500 tracking-widest">{t('academic.program')} *</label>
                    {loadingPrograms ? (
                      <div className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-xs text-gray-400">
                        <Loader2 size={14} className="animate-spin" /> Loading programs...
                      </div>
                    ) : (
                      <select 
                        value={formData.program_code} 
                        onChange={(e) => handleChange('program_code', e.target.value)}
                        className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none font-bold text-xs uppercase cursor-pointer"
                      >
                         <option value="">— Select {t('academic.program')} —</option>
                         {programs.map(p => (
                           <option key={p.id} value={p.id}>
                             {p.name} ({p.program_code}) — {p.degree_level}
                           </option>
                         ))}
                      </select>
                    )}
                 </div>
                 <div className="space-y-1">
                    <StudyCenterSelector 
                      value={formData.study_center_id || ''} 
                      onChange={(id) => handleChange('study_center_id', id)}
                      required
                      className="w-full"
                      label="Assigned Campus *"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-gray-500 tracking-widest">Admission Date</label>
                    <input 
                      type="date" 
                      value={formData.admission_date} 
                      onChange={(e) => handleChange('admission_date', e.target.value)}
                      className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 outline-none font-bold text-xs uppercase"
                    />
                 </div>
              </div>
           </div>

        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
           {error && (
             <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium">
               {error}
             </div>
           )}
           <div className="flex justify-end gap-4">
             <button 
               onClick={onClose}
               disabled={isSubmitting}
               className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
             >
               Cancel
             </button>
             <button 
               onClick={handleSubmit}
               disabled={isSubmitting}
               className="px-10 py-3 bg-[#4B0082] text-white rounded-none shadow-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 border border-[#FFD700]/30 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isSubmitting ? (
                 <>
                   <Loader2 size={16} className="text-[#FFD700] animate-spin" />
                   {initialData ? 'Updating...' : 'Saving...'}
                 </>
               ) : (
                 <>
                   <CheckCircle2 size={16} className="text-[#FFD700]" />
                   {initialData ? 'Update Record' : 'Confirm Enrollment'}
                 </>
               )}
             </button>
           </div>
        </div>

      </div>
    </div>
  );
};

export default StudentRegistrationModal;








