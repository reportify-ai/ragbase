import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { LLMModel } from './model-list';
import { z } from 'zod';
import { useTranslations } from '@/i18n/hooks';

const modelSchema = z.object({
  name: z.string().min(1, '请输入模型名称'),
  apiUrl: z.string().min(1, '请输入 API 地址'),
  apiKey: z.string().optional(),
  contextSize: z.coerce.number().min(1, '上下文长度需大于0'),
  temperature: z.coerce.number().min(0).max(2),
  topP: z.coerce.number().min(0).max(1),
  maxTokens: z.coerce.number().min(1),
  provider: z.string(),
  isDefault: z.boolean(),
});

interface ModelModalProps {
  open: boolean;
  model: LLMModel | null;
  onClose: () => void;
  onSave: (model: LLMModel) => void;
}

export function ModelModal({ open, model, onClose, onSave }: ModelModalProps) {
  const { t } = useTranslations();
  const [form, setForm] = useState({
    name: '',
    apiUrl: '',
    apiKey: '',
    contextSize: 2048,
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 1024,
    provider: 'ollama',
    isDefault: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (model) {
      setForm({
        name: model.name,
        apiUrl: model.path || '',
        apiKey: model.apiKey || '',
        contextSize: model.contextSize,
        temperature: model.temperature,
        topP: model.topP,
        maxTokens: model.maxTokens,
        provider: model.provider || 'ollama',
        isDefault: model.isDefault || false,
      });
    } else {
      setForm({
        name: '',
        apiUrl: '',
        apiKey: '',
        contextSize: 2048,
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 1024,
        provider: 'ollama',
        isDefault: false,
      });
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
    const result = modelSchema.safeParse(form);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    setError(null);
    onSave({
      id: model?.id || '',
      name: result.data.name,
      path: result.data.apiUrl,
      apiKey: result.data.apiKey,
      contextSize: result.data.contextSize,
      temperature: result.data.temperature,
      topP: result.data.topP,
      maxTokens: result.data.maxTokens,
      provider: result.data.provider,
      isDefault: result.data.isDefault,
    });
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 w-80">
        <h3 className="text-base font-semibold mb-2">{model ? t('pages.settings.editModel') : t('pages.settings.addModel')}</h3>
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
            placeholder={t('components.settings.apiUrlPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">{t('components.settings.apiKey')}</label>
          <input
            name="apiKey"
            className="w-full border rounded px-2 py-1 text-sm"
            value={form.apiKey}
            onChange={handleChange}
            placeholder={t('components.settings.apiKeyPlaceholder')}
            type="password"
            autoComplete="off"
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm mb-1">{t('components.settings.contextSize')}</label>
            <input
              name="contextSize"
              type="number"
              className="w-full border rounded px-2 py-1 text-sm"
              value={form.contextSize}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">{t('components.settings.temperature')}</label>
            <input
              name="temperature"
              type="number"
              step="0.01"
              className="w-full border rounded px-2 py-1 text-sm"
              value={form.temperature}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Top P</label>
            <input
              name="topP"
              type="number"
              step="0.01"
              className="w-full border rounded px-2 py-1 text-sm"
              value={form.topP}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">{t('components.settings.maxTokens')}</label>
            <input
              name="maxTokens"
              type="number"
              className="w-full border rounded px-2 py-1 text-sm"
              value={form.maxTokens}
              onChange={handleChange}
            />
          </div>
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
          <label htmlFor="isDefault" className="text-sm">{t('components.settings.setAsDefaultModel')}</label>
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