import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { EmbeddingModel } from './embedding-list';
import { useTranslations } from '@/i18n/hooks';

interface EmbeddingModalProps {
  open: boolean;
  model: EmbeddingModel | null;
  onClose: () => void;
  onSave: (model: EmbeddingModel) => void;
}

export function EmbeddingModal({ open, model, onClose, onSave }: EmbeddingModalProps) {
  const { t } = useTranslations();
  const [form, setForm] = useState({
    name: '',
    apiUrl: '',
    provider: 'ollama',
    isDefault: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (model) {
      setForm({
        name: model.name,
        apiUrl: model.path || '',
        provider: model.provider || 'ollama',
        isDefault: model.isDefault || false,
      });
    } else {
      setForm({ name: '', apiUrl: '', provider: 'ollama', isDefault: false });
    }
    setError(null);
  }, [model, open]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm(f => ({ ...f, [name]: checked }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError(t('api.errors.modelNameRequired'));
      return;
    }
    if (!form.apiUrl.trim()) {
      setError(t('api.errors.apiUrlRequired'));
      return;
    }
    setError(null);
    onSave({
      id: model?.id || '',
      name: form.name,
      path: form.apiUrl,
      provider: form.provider,
      isDefault: form.isDefault,
    });
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 w-80">
        <h3 className="text-base font-semibold mb-2">{model ? t('pages.settings.editEmbeddingModel') : t('pages.settings.addEmbeddingModel')}</h3>
        <div>
          <label className="block text-sm mb-1">{t('common.labels.modelName')}</label>
          <input
            name="name"
            className="w-full border rounded px-2 py-1 text-sm"
            value={form.name}
            onChange={handleChange}
            placeholder={t('pages.settings.modelNamePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">{t('common.labels.apiUrl')}</label>
          <input
            name="apiUrl"
            className="w-full border rounded px-2 py-1 text-sm"
            value={form.apiUrl}
            onChange={handleChange}
            placeholder={t('pages.settings.apiUrlPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">{t('common.labels.provider')}</label>
          <select
            name="provider"
            className="w-full border rounded px-2 py-1 text-sm"
            value={form.provider}
            onChange={handleChange}
          >
            <option value="ollama">{t('pages.settings.ollama')}</option>
            <option value="openai">{t('pages.settings.openai')}</option>
          </select>
        </div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isDefault"
            name="isDefault"
            checked={form.isDefault}
            onChange={handleChange}
            className="mr-2"
          />
          <label htmlFor="isDefault" className="text-sm">{t('pages.settings.setAsDefaultEmbeddingModel')}</label>
        </div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.buttons.cancel')}</Button>
          <Button type="submit">{t('common.buttons.save')}</Button>
        </div>
      </form>
    </Modal>
  );
} 