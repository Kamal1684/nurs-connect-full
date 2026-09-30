import React, { useState, useEffect } from 'react';
import { User, Camera, Trash2, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase, Profile } from '@/lib/supabase';
import { getInitials, cn } from '@/lib/utils';
import { useToast } from '@/components/ui';
import { useAuth } from '@/lib/auth';

interface NursePhotoAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'passport';
  shape?: 'circle' | 'rounded' | 'passport';
  className?: string;
  alt?: string;
}

export function NursePhotoAvatar({
  photoUrl,
  name,
  size = 'md',
  shape = 'circle',
  className,
  alt = 'Nurse Photo',
}: NursePhotoAvatarProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setImgError(false);
    if (!photoUrl) {
      setResolvedUrl(null);
      return;
    }

    // If it's already a full URL (http, https, blob, data), use directly
    if (
      photoUrl.startsWith('http://') ||
      photoUrl.startsWith('https://') ||
      photoUrl.startsWith('blob:') ||
      photoUrl.startsWith('data:')
    ) {
      setResolvedUrl(photoUrl);
      return;
    }

    // Otherwise, resolve signed URL from Supabase storage bucket 'nurse-documents'
    let isMounted = true;
    setLoading(true);
    supabase.storage
      .from('nurse-documents')
      .createSignedUrl(photoUrl, 3600 * 24 * 30) // 30 days
      .then(({ data, error }) => {
        if (!isMounted) return;
        setLoading(false);
        if (error || !data?.signedUrl) {
          // Try public URL fallback
          const { data: pub } = supabase.storage.from('nurse-documents').getPublicUrl(photoUrl);
          setResolvedUrl(pub?.publicUrl || null);
        } else {
          setResolvedUrl(data.signedUrl);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [photoUrl]);

  const sizeClasses = {
    xs: 'h-6 w-6 text-2xs',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-xl',
    '2xl': 'h-20 w-20 text-2xl',
    passport: 'w-28 h-36 text-2xl',
  };

  const shapeClasses = {
    circle: 'rounded-full',
    rounded: 'rounded-xl',
    passport: 'rounded-lg border-2 border-slate-200 shadow-xs',
  };

  const hasImage = Boolean(resolvedUrl && !imgError);

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 text-slate-700 select-none font-semibold',
        sizeClasses[size],
        shapeClasses[shape],
        className
      )}
    >
      {hasImage ? (
        <img
          src={resolvedUrl!}
          alt={alt || name || 'Nurse'}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100/80 text-primary-700">
          {name ? (
            <span className="font-bold tracking-tight">{getInitials(name)}</span>
          ) : (
            <User className={cn('h-1/2 w-1/2 text-primary-600/70')} />
          )}
        </div>
      )}
    </div>
  );
}

// Dedicated Passport Photo Upload Card for Nurse Profile
export function NursePassportPhotoUpload({
  profile,
  onPhotoUpdated,
}: {
  profile: Profile | null;
  onPhotoUpdated?: () => void;
}) {
  const { user, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const currentPhoto = profile?.profile_photo || profile?.avatar_url || null;

  // Resolve signed URL for preview
  useEffect(() => {
    if (!currentPhoto) {
      setPreviewUrl(null);
      return;
    }
    if (
      currentPhoto.startsWith('http://') ||
      currentPhoto.startsWith('https://') ||
      currentPhoto.startsWith('data:')
    ) {
      setPreviewUrl(currentPhoto);
      return;
    }

    supabase.storage
      .from('nurse-documents')
      .createSignedUrl(currentPhoto, 3600 * 24 * 30)
      .then(({ data }) => {
        if (data?.signedUrl) {
          setPreviewUrl(data.signedUrl);
        }
      });
  }, [currentPhoto]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // 1. Validate MIME type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      showToast('error', 'Invalid file format. Please upload a JPG, PNG, or WebP photo.');
      return;
    }

    // 2. Validate File Size (Max 3MB)
    const MAX_SIZE_BYTES = 3 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      showToast('error', 'Photo is too large. Maximum allowed size is 3 MB.');
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/passport-photo-${Date.now()}.${ext}`;

      // Upload to private nurse-documents bucket under user folder
      const { error: uploadError } = await supabase.storage
        .from('nurse-documents')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Generate signed URL
      const { data: signedData } = await supabase.storage
        .from('nurse-documents')
        .createSignedUrl(fileName, 3600 * 24 * 365); // 1 year

      const signedUrl = signedData?.signedUrl || null;

      // Update profiles record
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_photo: fileName,
          avatar_url: signedUrl || fileName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.warn('Profile photo update warning:', updateError);
      }

      await refreshProfile();
      if (onPhotoUpdated) onPhotoUpdated();
      showToast('success', 'Passport size photo uploaded and saved to your profile!');
    } catch (err: any) {
      console.error('Passport photo upload error:', err);
      showToast('error', 'Failed to upload photo: ' + (err.message || 'Network error'));
    } finally {
      setUploading(false);
      // Reset input value so same file can be reselected if needed
      e.target.value = '';
    }
  }

  async function handleRemovePhoto() {
    if (!user) return;
    setRemoving(true);

    try {
      // If there's an existing file path in storage, remove it
      if (profile?.profile_photo && !profile.profile_photo.startsWith('http')) {
        await supabase.storage
          .from('nurse-documents')
          .remove([profile.profile_photo]);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          profile_photo: null,
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setPreviewUrl(null);
      await refreshProfile();
      if (onPhotoUpdated) onPhotoUpdated();
      showToast('success', 'Passport size photo removed successfully.');
    } catch (err: any) {
      console.error('Remove photo error:', err);
      showToast('error', 'Failed to remove photo: ' + (err.message || 'Error occurred'));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary-600" />
            Passport Size Photo
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Your official identification photo displayed on hospital job applications, interviews, and verified badge.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
          <CheckCircle2 className="h-3 w-3" /> Standard 35×45mm
        </span>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Passport Photo Frame (35mm x 45mm proportion) */}
        <div className="relative group shrink-0">
          <div className="w-28 h-36 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden flex flex-col items-center justify-center p-1 shadow-2xs">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Nurse Passport Photo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-md"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-2 text-slate-400">
                <User className="h-10 w-10 text-slate-300 stroke-[1.5] mb-1" />
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">No Photo</span>
                <span className="text-[9px] text-slate-400">35 × 45 mm</span>
              </div>
            )}
          </div>
        </div>

        {/* Upload Controls & Guidelines */}
        <div className="flex-1 space-y-3 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <label className="relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition cursor-pointer shadow-xs disabled:opacity-50">
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  {previewUrl ? 'Change Photo' : 'Upload Passport Photo'}
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                disabled={uploading || removing}
                className="sr-only"
              />
            </label>

            {previewUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={uploading || removing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition"
              >
                {removing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Remove
              </button>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Photo Guidelines:</div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500">
              <li>Frontal view with face centered on a plain/light background</li>
              <li>Supported formats: <span className="font-medium text-slate-700">JPG, PNG, WebP</span></li>
              <li>Maximum file size: <span className="font-medium text-slate-700">3 MB</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
