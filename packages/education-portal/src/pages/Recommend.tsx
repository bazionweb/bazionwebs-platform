// src/pages/Recommend.tsx
// Public page for referees to submit a recommendation letter

import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from '../shims/react-router-dom';
import { api } from '../lib/api';
import type { RecommendationInfo } from '../lib/api';

export default function Recommend() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<RecommendationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    api.recommendations.getInfo(token)
      .then(setInfo)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load request info'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !info) return;
    
    setUploadStatus('uploading');
    setError('');
    try {
      const result: any = await api.recommendations.upload(token, file);
      if (result.success) {
        setUploadStatus('done');
        setInfo({ ...info, status: 'submitted' });
      } else {
        setUploadStatus('');
        setError((result as any).error || 'Upload failed');
      }
    } catch (err: unknown) {
      setUploadStatus('');
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  if (loading) return (
    <div className="page-center">
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  return (
    <div className="page" style={{ padding: '5rem 1.5rem 3rem', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link to="/" style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.5rem' }}>BMI University Portal</Link>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900, marginTop: '1rem' }}>
            Submit Recommendation
          </h1>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '2rem' }}>{error}</div>}

        {!info ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <h2 style={{ marginBottom: '0.5rem', color: 'var(--danger)' }}>Link Invalid</h2>
            <p style={{ color: 'var(--text-muted)' }}>This recommendation link is invalid or has expired. Please contact the applicant.</p>
          </div>
        ) : info.status === 'submitted' ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Recommendation Received</h2>
            <p style={{ color: 'var(--text-muted)' }}>Thank you, {info.referee_name}. We have successfully received your recommendation for {info.first_name} {info.last_name}.</p>
          </div>
        ) : (
          <div className="card">
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>Dear {info.referee_name},</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              <strong>{info.first_name} {info.last_name}</strong> has applied to the <strong>{info.program}</strong> program at BMI University and requested a letter of recommendation from you.
            </p>
            <div className="alert alert-info" style={{ marginBottom: '2rem' }}>
              Your recommendation letter will remain confidential and will only be viewed by the BMI University Admissions Committee. The applicant will not have access to this document.
            </div>

            <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '2.5rem', textAlign: 'center', background: uploadStatus === 'uploading' ? 'var(--bg)' : 'white' }}>
              {uploadStatus === 'uploading' ? (
                <div>
                  <div className="spinner" style={{ marginBottom: '1rem' }} />
                  <p style={{ fontWeight: 600 }}>Uploading document...</p>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📄</div>
                  <h3 style={{ marginBottom: '0.5rem' }}>Upload Recommendation Letter</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Accepted formats: PDF or Word Document (Max 10MB)</p>
                  <button className="btn btn-navy" onClick={() => fileRef.current?.click()}>
                    Select File
                  </button>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} style={{ display: 'none' }} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
