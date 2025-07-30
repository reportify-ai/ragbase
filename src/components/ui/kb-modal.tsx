import React, { useState, useEffect } from 'react';
import { Modal } from './modal';
import { Button } from './button';
import { useTranslations } from '@/i18n/hooks';

interface KbModalProps {
  open: boolean;
  kb: { id: number; name: string; description?: string } | null;
  onClose: () => void;
  onSave: (kb: { id?: number; name: string; description: string }) => void;
}

export function KbModal({ open, kb, onClose, onSave }: KbModalProps) {
  const { t } = useTranslations();
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kb) {
      setForm({ name: kb.name, description: kb.description || '' });
    } else {
      setForm({ name: '', description: '' });
    }
    setError(null);
  }, [kb, open]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(t('api.errors.modelNameRequired'));
      return;
    }
    setError(null);
    if (kb) {
      onSave({ id: kb.id, ...form });
    } else onSave(form);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 w-80">
        <h3 className="text-base font-semibold mb-2">{kb ? t('pages.kb.editKnowledgeBase') : t('pages.kb.createKnowledgeBase')}</h3>
        <div>
          <label className="block text-sm mb-1">{t('pages.kb.knowledgeBaseName')}</label>
          <input
            name="name"
            className="w-full border rounded px-2 py-1 text-sm"
            value={form.name}
            onChange={handleChange}
            placeholder={t('pages.kb.knowledgeBaseNamePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">{t('pages.kb.knowledgeBaseDescription')}</label>
          <textarea
            name="description"
            className="w-full border rounded px-2 py-1 text-sm"
            value={form.description}
            onChange={handleChange}
            placeholder={t('pages.kb.knowledgeBaseDescriptionPlaceholder')}
          />
        </div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="hover:cursor-pointer">{t('common.buttons.cancel')}</Button>
          <Button type="submit" className="hover:cursor-pointer">{t('common.buttons.save')}</Button>
        </div>
      </form>
    </Modal>
  );
} 